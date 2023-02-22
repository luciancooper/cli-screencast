import type { Optionalize } from '../types';
import type {
    NameTable, FvarTable, Os2Table, HeadTable, CmapTable, SfntHeader, SystemFont,
} from './types';
import FontReader from './reader';
import { getEncoding } from './encoding';
import { localizeNames } from './names';
import { getFontStyle, extendFontStyle } from './style';
import { cmapCoverage, cmapEncodingPriority } from './cmap';

type DecodeCallback<T> = (this: FontDecoder, header: SfntHeader) => T | PromiseLike<T>;

export default class FontDecoder extends FontReader {
    /** optional list of font family names to match */
    private readonly match: string[] | null;

    /** lookup to memoize decoded parts of the font file */
    private memoized: Record<number, any> | null = null;

    constructor({ filePath, match }: Optionalize<{ filePath?: string, match?: string[] }> = {}) {
        super(filePath);
        this.match = match ?? null;
    }

    protected override close() {
        return super.close().then(() => {
            // reset memoization lookup when file is closed
            this.memoized = null;
        });
    }

    /**
     * Reads the span of bytes for a font table from the file, then calls the provided callback
     */
    protected async decodeSfntTable<T>(
        { tables }: SfntHeader,
        tableTag: number | string,
        decode: (this: FontDecoder) => T | PromiseLike<T>,
        initialBytes?: number,
    ): Promise<T | null> {
        const tag = typeof tableTag === 'string' ? this.tagUInt32(tableTag) : tableTag,
            record = tables.find((t) => t.tag === tag);
        if (!record) return null;
        const { offset, bytes } = record;
        // check if table has already been decoded and result has been memoized
        if (this.memoized?.[offset]) {
            return this.memoized[offset] as T;
        }
        // set pointer adjustment offset
        this.fd_offset = offset;
        // read table bytes
        await this.read(initialBytes ?? bytes, 0);
        // decode table
        const decoded = await decode.call(this);
        // reset pointer adjustment offset
        this.fd_offset = 0;
        // memoize decoded table
        if (this.memoized) {
            this.memoized[offset] = decoded;
        }
        // return decoded table
        return decoded;
    }

    protected async decodeLocalizedNames(header: SfntHeader) {
        // decode 'name' table for this subfont
        const name = await this.decodeSfntTable(header, 'name', this.nameTable);
        // throw error if font does not have a 'name' table
        if (!name) throw new Error("Font does not include required 'name' table");
        // decode 'ltag' table if present
        const ltag = await this.decodeSfntTable(header, 'ltag', this.ltagTable);
        // localize name table records
        return localizeNames(name, ltag);
    }

    /**
     * https://learn.microsoft.com/en-us/typography/opentype/spec/name
     */
    protected nameTable(): NameTable {
        // decode name table
        const [version, nameRecordCount, storageOffset] = [this.uint16(), this.uint16(), this.uint16()],
            // https://learn.microsoft.com/en-us/typography/opentype/spec/name#name-records
            nameRecords = this.array(nameRecordCount, () => ({
                platformID: this.uint16(),
                encodingID: this.uint16(),
                languageID: this.uint16(),
                nameID: this.uint16(),
                length: this.uint16(),
                offset: this.uint16(),
            }));
        let langRecords: { length: number, offset: number }[] = [];
        // decode lang tags if table version is 1
        if (version === 1) {
            const langTagCount = this.uint16();
            // https://learn.microsoft.com/en-us/typography/opentype/spec/name#naming-table-version-1
            langRecords = this.array(langTagCount, () => ({
                length: this.uint16(),
                offset: this.uint16(),
            }));
        }
        return {
            records: nameRecords.map(({
                platformID,
                languageID,
                encodingID,
                nameID,
                offset,
                length,
            }) => {
                const encoding = getEncoding(platformID, encodingID, languageID);
                this.setPointer(storageOffset + offset);
                const string = this.string(length, encoding);
                return {
                    platformID,
                    languageID,
                    nameID,
                    string,
                };
            }),
            langTags: version === 1 ? langRecords.map(({ offset, length }) => {
                this.setPointer(storageOffset + offset);
                return this.string(length, 'utf-16be');
            }) : null,
        };
    }

    /**
     * Decode ltag table
     */
    protected ltagTable(): string[] {
        const numTags = this.skip(8).uint32(),
            tagRanges = this.array(numTags, () => ({ offset: this.uint16(), length: this.uint16() })),
            strings: Record<number, string> = {};
        for (const { offset, length } of tagRanges.slice().sort(({ offset: a }, { offset: b }) => a - b)) {
            this.setPointer(offset);
            strings[offset] = this.utf16(length);
        }
        return tagRanges.map(({ offset }) => strings[offset]!);
    }

    /**
     * https://learn.microsoft.com/en-us/typography/opentype/spec/fvar
     */
    protected fvarTable(): FvarTable {
        const axesOffset = this.skip(4).uint16(),
            axisCount = this.skip(2).uint16(),
            instanceCount = this.skip(2).uint16(),
            instanceSize = this.uint16();
        // set buffer position to the axis offset pointer
        this.setPointer(axesOffset);
        return {
            // https://learn.microsoft.com/en-us/typography/opentype/spec/fvar#variationaxisrecord
            axes: this.array(axisCount, () => ({
                tag: this.utf8(4),
                min: this.fixed32(),
                def: this.fixed32(),
                max: this.fixed32(),
                flags: this.uint16(),
                nameID: this.uint16(),
            })),
            // https://learn.microsoft.com/en-us/typography/opentype/spec/fvar#instancerecord
            instances: this.array(instanceCount, () => ({
                sfNameID: this.uint16(),
                coordsArray: this.skip(2).array(axisCount, this.fixed32),
                psNameID: (instanceSize > 4 + axisCount * 4) ? this.uint16() : null,
            })),
        };
    }

    /**
     * Need first 56 bytes of the table
     * https://learn.microsoft.com/en-us/typography/opentype/spec/os2
     */
    protected os2Table(): Os2Table {
        return {
            version: this.uint16(),
            // ...2 bytes...
            usWeightClass: this.skip(2).uint16(),
            usWidthClass: this.uint16(),
            // ...54 bytes...
            // https://learn.microsoft.com/en-us/typography/opentype/spec/os2#fsselection
            fsSelection: this.skip(54).uint16(),
        };
    }

    /**
     * Need first 46 bytes
     * https://learn.microsoft.com/en-us/typography/opentype/spec/head
     * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6head.html
     */
    protected headTable(): HeadTable {
        return {
            // ...44 bytes...
            macStyle: this.skip(44).uint16(),
        };
    }

    protected async cmapEncodingRecords() {
        const numTables = this.skip(2).uint16();
        // decode the cmap encoding records
        await this.read(8 * numTables);
        return this.array(numTables, () => ({
            platformID: this.uint16(),
            encodingID: this.uint16(),
            subtableOffset: this.uint32(),
        }));
    }

    protected async cmapSubtable(subtableOffset: number): Promise<CmapTable> {
        // move pointer to subtable offset
        this.setPointer(subtableOffset);
        // read first 2 bytes
        await this.read(2);
        // decode subtable format
        const format = this.uint16() as CmapTable['format'];
        // decode cmap subtable
        switch (format) {
            case 0: {
                // read next 4 bytes
                await this.read(4);
                const length = this.uint16(), // read 2 bytes
                    language = this.uint16();
                // read the length of the subtable
                await this.read(length - 6);
                // decode glyph id array
                const glyphIdArray = this.array(length - 6, this.uint8);
                return { format: 0, language, glyphIdArray };
            }
            case 2: {
                // read next 4 bytes
                await this.read(4);
                const length = this.uint16(),
                    language = this.uint16();
                // read the rest of the subtable
                await this.read(length - 6);
                // decode subheader keys
                const subHeaderKeys = this.array(256, this.uint16),
                    subHeaderCount = Math.max(...subHeaderKeys.map((k) => k >> 3)) + 1;
                return {
                    format,
                    language,
                    subHeaderKeys,
                    subHeaderCount,
                    subHeaders: this.array(subHeaderCount, () => ({
                        firstCode: this.uint16(),
                        entryCount: this.uint16(),
                        idDelta: this.int16(),
                        idRangeOffset: this.uint16(),
                    })),
                    glyphIdArray: this.array((length - 518 - subHeaderCount * 8) >> 1, this.uint16),
                };
            }
            case 4: {
                // read next 6 bytes
                await this.read(6);
                const length = this.uint16(), // read 2 bytes
                    language = this.uint16(),
                    segCount = this.uint16() >> 1;
                // read remaining bytes in this subtable
                await this.read(length - 8);
                return {
                    format,
                    language,
                    segCount,
                    endCodes: this.skip(6).array(segCount, this.uint16),
                    startCodes: this.skip(2).array(segCount, this.uint16),
                    idDeltas: this.array(segCount, this.int16),
                    idRangeOffsets: this.array(segCount, this.uint16),
                    glyphIdArray: this.array((length - (16 + 8 * segCount)) >> 1, this.uint16),
                };
            }
            case 6: {
                // read next 4 bytes
                await this.read(4);
                const length = this.uint16(), // read 2 bytes
                    language = this.uint16();
                // read remaining bytes in this subtable
                await this.read(length - 6);
                const startCharCode = this.uint16(),
                    numChars = this.uint16();
                return {
                    format,
                    language,
                    startCharCode,
                    numChars,
                    glyphIdArray: this.array(numChars, this.uint16),
                };
            }
            case 10: {
                // read next 10 bytes for length & language
                await this.read(10);
                const length = this.skip(2).uint32(),
                    language = this.uint32();
                // read the rest of the subtable
                await this.read(length - 12);
                return {
                    format,
                    language,
                    startCharCode: this.uint32(),
                    numChars: this.uint32(),
                    glyphIdArray: this.array((length - 20) >> 1, this.uint16),
                };
            }
            case 8: {
                // read next 10 bytes for length & language
                await this.read(10);
                const length = this.skip(2).uint32(), // read 6 bytes
                    language = this.uint32();
                // read the rest of the subtable
                await this.read(length - 12);
                const is32 = this.array(8192, this.uint8);
                return {
                    format,
                    language,
                    is32,
                    groups: this.array(this.uint32(), () => ({
                        startCharCode: this.uint32(),
                        endCharCode: this.uint32(),
                        glyphID: this.uint32(),
                    })),
                };
            }
            case 12:
            case 13: {
                // read next 10 bytes for length & language
                await this.read(10);
                const length = this.skip(2).uint32(), // read 6 bytes
                    language = this.uint32();
                // read the rest of the subtable
                await this.read(length - 12);
                // decode sequential (12) / constant (13) map groups
                const groups = this.array(this.uint32(), () => ({
                    startCharCode: this.uint32(),
                    endCharCode: this.uint32(),
                    glyphID: this.uint32(),
                }));
                return { format, language, groups };
            }
            case 14:
                return { format, language: 0 };
            // no default required - switch is exaustive
        }
    }

    /**
     * https://learn.microsoft.com/en-us/typography/opentype/spec/cmap
     */
    protected async cmapTable(): Promise<CmapTable> {
        const encodingRecords = await this.cmapEncodingRecords();
        // select the proper encoding record
        let record: (typeof encodingRecords)[number] | undefined;
        for (const [platformID, encodingID] of cmapEncodingPriority) {
            record = encodingRecords.find((rec) => (
                rec.platformID === platformID && rec.encodingID === encodingID
            ));
            if (record) break;
        }
        if (!record) {
            throw new Error(
                'Font does not include a supported cmap subtable:'
                + encodingRecords.map(({ platformID, encodingID, subtableOffset }) => (
                    `\n * platform: ${platformID} encoding: ${encodingID} offset: ${subtableOffset}`
                )).join(''),
            );
        }
        return this.cmapSubtable(record.subtableOffset);
    }

    protected async sfntHeader(): Promise<SfntHeader> {
        // decode the sfnt signature
        const signature = this.uint32();
        // decode first 8 bytes
        await this.read(8);
        const fields = {
            signature,
            numTables: this.uint16(),
            searchRange: this.uint16(),
            entrySelector: this.uint16(),
            rangeShift: this.uint16(),
        };
        // decode table directory
        await this.read(fields.numTables * 16);
        const tables = this.array(fields.numTables, () => ({
            tag: this.uint32(),
            checksum: this.uint32(),
            offset: this.uint32(),
            bytes: this.uint32(),
        }));
        // return header
        return { ...fields, tables };
    }

    protected async ttcHeaders(): Promise<SfntHeader[]> {
        // skip the 'ttcf' signature
        this.skip(4);
        // decode number of fonts from the first 8 bytes
        await this.read(8);
        const numFonts = this.skip(4).uint32();
        // decode table directory offsets
        await this.read(numFonts * 4);
        const offsets = this.array(numFonts, this.uint32),
            // initialize subfont array
            fontHeaders: SfntHeader[] = [];
        // decode subfont table directories
        for (const offset of offsets) {
            // read the first 4 bytes of the subfont header
            await this.read(4, offset);
            // decode the sfnt header
            const header = await this.sfntHeader();
            // add to font headers array
            fontHeaders.push(header);
        }
        return fontHeaders;
    }

    private async* decodeSfntSystemFonts(header: SfntHeader) {
        // decode localized 'name' table
        const names = await this.decodeLocalizedNames(header),
            // decode 'OS/2' table
            os2 = await this.decodeSfntTable(header, 'OS/2', this.os2Table),
            // decode 'head' table
            head = await this.decodeSfntTable(header, 'head', this.headTable),
            // determine font family name and font style
            { family, style } = getFontStyle(names, os2, head);
        // apply family name filter if provided
        if (!family || (this.match && !this.match.includes(family))) return;
        // decode 'cmap' table
        const cmap = await this.decodeSfntTable(header, 'cmap', this.cmapTable, 4);
        // code point coverage cannot be determined if font does not contain a 'cmap' table
        if (!cmap) return;
        // determine code point coverage
        const coverage = cmapCoverage(cmap),
            // decode 'fvar' table if present
            fvar = await this.decodeSfntTable(header, 'fvar', this.fvarTable);
        // check for fvar variants
        if (fvar) {
            // create fvar axis map
            const axes: Record<string, FvarTable['axes'][number]> = {};
            for (const axis of fvar.axes) {
                axes[axis.tag] = axis;
            }
            // process each fvar instance
            for (const { coordsArray, sfNameID } of fvar.instances) {
                // create coord map & calculate default score
                const coords: Record<string, number> = {};
                let defscore = 0;
                for (const [i, { tag, def }] of fvar.axes.entries()) {
                    const coord = coordsArray[i]!;
                    coords[tag] = coord;
                    defscore += (tag !== 'wght' && def === coord) ? 1 : 0;
                }
                // yield fvar instance data
                yield {
                    family,
                    coverage,
                    style: extendFontStyle(style, axes, names[sfNameID]!, coords),
                    fvarInstance: { coords, defscore },
                };
            }
        } else {
            yield { family, style, coverage };
        }
    }

    /**
     * Decode the font file and extract system font info
     * @param match - optional array of font family names to match
     */
    async decodeFileFonts(filePath: string): Promise<SystemFont[]> {
        try {
            this.filePath = filePath;
            // create array to store system font data
            const fonts: SystemFont[] = [];
            // read first 4 bytes of the font file
            await this.read(4);
            const type = this.buf.readUInt32BE(this.buf_pos); // this.uint32();
            switch (type) {
                case 0x4F54544F: // 'OTTO' -> open type with CFF data (version 1 or 2)
                case 0x74727565: // 'true'
                case 0x74797031: // 'typ1'
                case 0x00010000: { // true type outlines
                    // decode sfnt font header
                    const header = await this.sfntHeader();
                    // extract system font info
                    for await (const font of this.decodeSfntSystemFonts(header)) {
                        fonts.push({ filePath, ...font });
                    }
                    break;
                }
                // 'ttcf'
                case 0x74746366: {
                    // initialize memoization lookup avoid re-decoding shared tables
                    this.memoized = {};
                    // decode ttc subfont headers
                    const headers = await this.ttcHeaders();
                    // loop through ttc subfonts
                    for (const header of headers) {
                        // extract system font info from the subfont
                        for await (const font of this.decodeSfntSystemFonts(header)) {
                            fonts.push({ filePath, ...font, ttcSubfont: header });
                        }
                    }
                    break;
                }
                case 0x774F4646: // 'wOFF'
                    throw new Error('woff font decoding is not supported');
                case 0x774F4632: // 'wOF2'
                    throw new Error('woff2 font decoding is not supported');
                default:
                    throw new Error(`Invalid font signature ${type}`);
            }
            return fonts;
        } finally {
            await this.close();
        }
    }

    /**
     * Calls the provided decoder callback function on each font in the file
     */
    async* decodeAll<T>(decoder: DecodeCallback<T>): AsyncGenerator<T> {
        try {
            // read first 4 bytes of the font file
            await this.read(4);
            const type = this.buf.readUInt32BE(this.buf_pos); // this.uint32();
            switch (type) {
                case 0x4F54544F: // 'OTTO' -> open type with CFF data (version 1 or 2)
                case 0x74727565: // 'true'
                case 0x74797031: // 'typ1'
                case 0x00010000: // true type outlines
                    yield (await decoder.call(this, await this.sfntHeader()));
                    break;
                // 'ttcf'
                case 0x74746366:
                    // initialize memoization lookup avoid re-decoding shared tables
                    this.memoized = {};
                    // decode ttc subfont headers
                    for (const header of (await this.ttcHeaders())) {
                        yield (await decoder.call(this, header));
                    }
                    break;
                case 0x774F4646: // 'wOFF'
                    throw new Error('woff font decoding is not supported');
                case 0x774F4632: // 'wOF2'
                    throw new Error('woff2 font decoding is not supported');
                default:
                    throw new Error(`Invalid font signature ${type}`);
            }
        } finally {
            await this.close();
        }
    }

    /**
     * Calls the provided decoder callback function on the first font in the file
     */
    async decodeFirst<T>(decoder: DecodeCallback<T>): Promise<T> {
        const each = this.decodeAll(decoder),
            { value } = (await each.next()) as IteratorYieldResult<T>;
        // finish the generator to close the file
        await each.return(null);
        return value;
    }
}