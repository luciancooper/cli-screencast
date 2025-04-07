import type { Optionalize } from '../types';
import type {
    NameRecord, FvarTable, Os2Table, HeadTable, MaxpTable, CmapTable, SfntHeader, FontData, FontSource, SystemFont,
} from './types';
import FontReader from './reader';
import { getEncoding } from './encoding';
import { getLanguage, localizeNames, caselessMatch } from './names';
import { getFontStyle, extendFontStyle } from './style';
import { cmapCoverage, selectCmapRecord, type CmapEncodingRecord } from './cmap';
import { fetchFont } from './utils';

export default class FontDecoder extends FontReader {

    /** optional list of font family names to match */
    private readonly match: string[] | null;

    /** lookup to memoize decoded parts of the font file */
    private memoized: Record<number, any> | null = null;

    constructor({ filePath, match }: Optionalize<{ filePath?: string, match?: string[] }> = {}) {
        super(filePath);
        this.match = match ?? null;
    }

    protected override reset() {
        super.reset();
        // reset memoization lookup
        this.memoized = null;
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
        // decode 'ltag' table if present
        const ltag = await this.decodeSfntTable(header, 'ltag', this.ltagTable),
            // decode 'name' table for this subfont
            name = await this.decodeSfntTable(header, 'name', () => this.nameTable(ltag));
        // throw error if font does not have a 'name' table
        if (!name) throw new Error("Font does not include required 'name' table");
        // localize name table records
        return localizeNames(name);
    }

    /**
     * https://learn.microsoft.com/en-us/typography/opentype/spec/name
     */
    protected nameTable(ltag: string[] | null): NameRecord[] {
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
        let langTags: string[] | null = null;
        // decode lang tags if table version is 1
        if (version === 1) {
            // https://learn.microsoft.com/en-us/typography/opentype/spec/name#naming-table-version-1
            const langRecords = this.array(this.uint16(), () => ({
                length: this.uint16(),
                offset: this.uint16(),
            }));
            // decode each language tag
            langTags = langRecords.map(({ offset, length }) => {
                this.setPointer(storageOffset + offset);
                return this.string(length, 'utf-16be');
            });
        }
        // decode each name record
        return nameRecords.map(({
            platformID,
            languageID,
            encodingID,
            nameID,
            offset,
            length,
        }) => {
            const encoding = getEncoding(platformID, encodingID, languageID),
                lang = getLanguage(platformID, languageID, langTags, ltag);
            // set pointer and decode string
            this.setPointer(storageOffset + offset);
            const string = this.string(length, encoding);
            return {
                platformID,
                languageID,
                encodingID,
                nameID,
                string,
                encoding,
                lang,
            };
        });
    }

    /**
     * Decode ltag table
     */
    protected ltagTable(): string[] {
        const numTags = this.skip(8).uint32(),
            tagRanges = this.array(numTags, () => ({ offset: this.uint16(), length: this.uint16() })),
            ltags: string[] = [];
        for (const { offset, length } of tagRanges) {
            this.setPointer(offset);
            ltags.push(this.utf8(length));
        }
        return ltags;
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
            // ...18 bytes...
            unitsPerEm: this.skip(18).uint16(),
            // ...24 bytes...
            macStyle: this.skip(24).uint16(),
        };
    }

    /**
     * Need first 6 bytes
     * https://learn.microsoft.com/en-us/typography/opentype/spec/maxp
     */
    protected maxpTable(): MaxpTable {
        return {
            // ... 4 bytes ...
            numGlyphs: this.skip(4).uint16(),
        };
    }

    protected async cmapEncodingRecords(): Promise<CmapEncodingRecord[]> {
        const numTables = this.skip(2).uint16();
        // read enough bytes to decode all encoding records
        await this.read(8 * numTables);
        // decode the cmap encoding records
        return this.array(numTables, () => ({
            platform: this.uint16(),
            encoding: this.uint16(),
            offset: this.uint32(),
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
            case 14: {
                // read next 8 bytes for subtable length + numVarSelectorRecords
                await this.read(8);
                // skip length & decode number of variation selector records
                const numRecords = this.skip(4).uint32();
                // read bytes needed to decode the varSelector array
                await this.read(numRecords * 11);
                // decode only the var selector code point from each record
                const varSelectors: number[] = [];
                for (let i = 0; i < numRecords; i += 1) {
                    varSelectors.push(this.uint24());
                    this.skip(8); // skip the defaultUVSOffset & nonDefaultUVSOffset fields
                }
                return { format, language: 0, varSelectors };
            }
            // no default required - switch is exaustive
        }
    }

    /**
     * https://learn.microsoft.com/en-us/typography/opentype/spec/cmap
     */
    protected async cmapTable() {
        const encodingRecords = await this.cmapEncodingRecords(),
            // select a cmap encoding record to decode
            record = selectCmapRecord(encodingRecords),
            // decode cmap subtable
            table = await this.cmapSubtable(record.offset);
        // decode format 14 unicode variation sequences table if one is present
        let varSelectors: number[] | null = null;
        const uvsRecord = encodingRecords.find((rec) => (rec.platform === 0 && rec.encoding === 5));
        if (uvsRecord) {
            ({ varSelectors } = await this.cmapSubtable(uvsRecord.offset) as Extract<CmapTable, { format: 14 }>);
        }
        return { table, varSelectors };
    }

    /**
     * Decode advance width array from 'hhea' & 'hmtx' tables
     * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/hhea}
     * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/hmtx}
     */
    async decodeHmtx(header: SfntHeader) {
        // decode `numberOfHMetrics` key from the 'hhea' table
        const hmetrics = await this.decodeSfntTable(header, 'hhea', () => this.skip(34).uint16());
        if (!hmetrics) return null;
        // decode 'hmtx' table, need the first (numberOfHMetrics * 4) bytes
        return this.decodeSfntTable(header, 'hmtx', () => this.array(hmetrics, () => {
            const advanceWidth = this.uint16();
            this.skip(2);
            return advanceWidth;
        }), hmetrics * 4);
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

    async* decodeSfntSystemFonts(header: SfntHeader, ttc: boolean): AsyncGenerator<FontData> {
        // decode localized 'name' table
        const names = await this.decodeLocalizedNames(header),
            // decode 'OS/2' table
            os2 = await this.decodeSfntTable(header, 'OS/2', this.os2Table),
            // decode 'head' table
            head = await this.decodeSfntTable(header, 'head', this.headTable),
            // determine font family name and font style
            { family, style } = getFontStyle(names, os2, head);
        // apply family name filter if provided
        if (this.match && (!family || !caselessMatch(this.match, family))) return;
        // decode 'cmap' table
        const cmap = await this.decodeSfntTable(header, 'cmap', this.cmapTable, 4);
        // code point coverage cannot be determined if font does not contain a 'cmap' table
        if (!cmap) return;
        // decode 'maxp' table
        const maxp = await this.decodeSfntTable(header, 'maxp', this.maxpTable, 6);
        // font is invalid if it does not contain a 'maxp' table
        if (!maxp) return;
        // get advance width array
        let advanceWidth: number[] = [];
        if (head) {
            // decode 'htmx' table
            const hmtx = await this.decodeHmtx(header);
            // only use advance widths if number of unique widths <= 10, otherwise this is not a monospaced font
            if (hmtx && new Set(hmtx).size <= 10) advanceWidth = hmtx.map((v) => v / head.unitsPerEm);
        }
        // determine code point coverage
        const coverage = cmapCoverage(cmap, maxp.numGlyphs, advanceWidth),
            // decode 'fvar' table if present
            fvar = await this.decodeSfntTable(header, 'fvar', this.fvarTable),
            // create base font data object
            data: FontData = { family, style, coverage };
        // add ttcSubfont field if this is from a true type collection
        if (ttc) data.ttcSubfont = header;
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
                    ...data,
                    style: extendFontStyle(style, axes, names[sfNameID]!, coords),
                    fvarInstance: { coords, defscore },
                };
            }
        } else {
            yield data;
        }
    }

    /**
     * Calls the provided decoder callback function on each font in the file
     */
    async* decodeAll<T>(
        decoder: (this: FontDecoder, header: SfntHeader, ttc: boolean) => AsyncGenerator<T>,
        onWoff2?: () => void,
    ): AsyncGenerator<T> {
        try {
            // read first 4 bytes of the font file
            await this.read(4);
            let type = this.buf.readUInt32BE(this.buf_pos);
            // check for wOF2
            if (type === 0x774F4632) {
                // call the woff2 cb
                if (onWoff2) onWoff2();
                // decompress the underlying data
                await this.decompressWoff2();
                // read new type from decompressed data
                type = this.buf.readUInt32BE(this.buf_pos);
            }
            switch (type) {
                case 0x4F54544F: // 'OTTO' -> open type with CFF data (version 1 or 2)
                case 0x74727565: // 'true'
                case 0x74797031: // 'typ1'
                case 0x00010000: { // true type outlines
                    // decode sfnt font header
                    const header = await this.sfntHeader();
                    // call decoder callback
                    yield* decoder.call(this, header, false);
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
                        yield* decoder.call(this, header, true);
                    }
                    break;
                }
                case 0x774F4646: // 'wOFF'
                    throw new Error('woff font decoding is not supported');
                case 0x504b0304:
                case 0x504B0506:
                case 0x504B0708:
                    throw new Error('zip files are not supported');
                default:
                    throw new Error(`invalid font signature ${type}`);
            }
        } finally {
            await this.close();
        }
    }

    /**
     * Decode a font file or remote font and extract system font info
     * @param source - source of the font data to decode
     */
    async* decodeFonts(src: FontSource): AsyncGenerator<SystemFont> {
        if (typeof src.file !== 'string') {
            // download font from url
            const buffer = await fetchFont(src.file);
            if (!buffer) return;
            this.setBuffer(buffer);
        } else {
            // set font file path
            this.filePath = src.file;
        }
        const woff2 = () => {
            src.woff2 = true;
        };
        // decode all fonts
        for await (const font of this.decodeAll(this.decodeSfntSystemFonts, woff2)) {
            yield { src, ...font };
        }
    }

    /**
     * Decodes all fonts in a file. Only used during testing
     * @internal
     */
    async decodeFontsArray(source: string | Buffer): Promise<FontData[]> {
        // set source
        if (typeof source === 'string') this.filePath = source;
        else this.setBuffer(source);
        // create array to store font data
        const fonts: FontData[] = [];
        // decode fonts
        for await (const font of this.decodeAll(this.decodeSfntSystemFonts)) {
            fonts.push(font);
        }
        return fonts;
    }

    /**
     * Calls the provided decoder callback function on the first font in the file. Only used during testing
     * @internal
     */
    async decodeFirst<T>(
        decoder: (this: FontDecoder, header: SfntHeader, ttc: boolean) => T | PromiseLike<T>,
    ): Promise<T> {
        const each = this.decodeAll(async function* wrapper(...args) {
                yield (await decoder.call(this, ...args));
            }),
            { value } = (await each.next()) as IteratorYieldResult<T>;
        // finish the generator to close the file
        await each.return(null);
        return value;
    }
}