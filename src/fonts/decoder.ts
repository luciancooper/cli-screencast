import { TextDecoder } from 'util';
import type {
    NameTable, FvarTable, Os2Table, HeadTable, CmapTable, SfntHeader, SystemFont,
} from './types';
import FontReader from './reader';
import { getEncoding } from './encoding';
import { localizeNames } from './names';
import { getFontStyle, extendFontStyle } from './style';
import { cmapCoverage, cmapEncodingPriority } from './cmap';

const utf16Decoder = new TextDecoder('utf-16be');

type DecodeCallback<T> = (
    this: FontDecoder,
    header: SfntHeader,
    memo: Record<number, any> | null,
) => T | PromiseLike<T>;

export default class FontDecoder extends FontReader {
    protected buf: Buffer;

    protected fd_pos = 0;

    protected fd_eof = false;

    protected buf_pos = 0;

    protected buf_bytes = 0;

    /**
     * Used to adjust relative pointers
     */
    protected fd_offset = 0;

    constructor(filePath: string) {
        super(filePath);
        this.buf = Buffer.alloc(0);
    }

    protected async read(bytes: number, offset?: number) {
        // byte index range of data to be read
        const f1 = offset != null ? this.fd_offset + offset : this.fd_pos + this.buf_pos,
            f2 = f1 + bytes;
        // check if requested byte range has already been read
        if (f1 >= this.fd_pos && f2 <= this.fd_pos + this.buf_bytes) {
            // if offset arg was provided, update buffer position
            if (offset != null) this.buf_pos = f1 - this.fd_pos;
            return;
        }
        // allocate a new buffer
        const buf = Buffer.alloc(bytes);
        let [read_pos, read_bytes, extra_bytes] = [f1, bytes, 0];
        // handle overlaps between current buffer and byte read span
        if (f1 >= this.fd_pos && f1 < this.fd_pos + this.buf_bytes) {
            // copy overlapping bytes to the beginning of the new buffer
            this.buf.copy(buf, 0, f1 - this.fd_pos, this.buf_bytes);
            // update buffer byte length
            this.buf_bytes = this.fd_pos + this.buf_bytes - f1;
            // update read position + read byte count
            [read_pos, read_bytes] = [read_pos + this.buf_bytes, read_bytes - this.buf_bytes];
        } else if (f1 < this.fd_pos && f2 > this.fd_pos) {
            // copy overlapping bytes to the end of the new buffer
            this.buf.copy(buf, this.fd_pos - f1, 0, f2 - this.fd_pos);
            // reset buffer byte length
            this.buf_bytes = 0;
            // store overlapping byte count
            [extra_bytes, read_bytes] = [f2 - this.fd_pos, this.fd_pos - f1];
        } else {
            // reset buffer byte length
            this.buf_bytes = 0;
        }
        // set the byte index position in the source file
        this.fd_pos = f1;
        // reset the byte position in the buffer
        this.buf_pos = 0;
        // replace the active buffer
        this.buf = buf;
        // execute read
        const { bytesRead, eof } = await this.executeRead(buf, this.buf_bytes, read_bytes, read_pos);
        this.fd_eof = eof;
        this.buf_bytes += bytesRead + extra_bytes;
    }

    protected setPointer(pointer: number) {
        const pos = this.fd_offset + pointer;
        if (pos < this.fd_pos || pos > this.fd_pos + this.buf_bytes) {
            if (pos < 0) throw new Error(`Invalid pointer: ${pointer}`);
            this.fd_pos = pos;
            this.buf_pos = 0;
            this.buf_bytes = 0;
        } else this.buf_pos = pos - this.fd_pos;
    }

    protected skip(bytes: number): this {
        this.buf_pos += bytes;
        return this;
    }

    protected uint8() {
        const int = this.buf.readUInt8(this.buf_pos);
        this.buf_pos += 1;
        return int;
    }

    protected int16() {
        const int = this.buf.readInt16BE(this.buf_pos);
        this.buf_pos += 2;
        return int;
    }

    protected uint16() {
        const int = this.buf.readUInt16BE(this.buf_pos);
        this.buf_pos += 2;
        return int;
    }

    protected uint32() {
        const int = this.buf.readUInt32BE(this.buf_pos);
        this.buf_pos += 4;
        return int;
    }

    protected fixed32() {
        const [whole, frac] = [this.uint16(), this.uint16()];
        return whole + frac / (2 ** 16);
    }

    protected array<T>(length: number, cb: () => T): T[] {
        const array: T[] = [];
        for (let i = 0; i < length; i += 1) array.push(cb.call(this));
        return array;
    }

    protected utf8(bytes: number) {
        const str = this.buf.toString('utf-8', this.buf_pos, this.buf_pos + bytes);
        this.buf_pos += bytes;
        return str;
    }

    protected utf16(bytes: number) {
        const str = utf16Decoder.decode(this.buf.subarray(this.buf_pos, this.buf_pos + bytes));
        this.buf_pos += bytes;
        return str;
    }

    protected string(bytes: number, encoding: string) {
        const span = this.buf.subarray(this.buf_pos, this.buf_pos + bytes);
        this.buf_pos += bytes;
        try {
            return new TextDecoder(encoding).decode(span);
        } catch (err) {
            return utf16Decoder.decode(span);
        }
    }

    /**
     * convert a 4 char tag value to its uint32 value
     */
    protected tagUInt32(tag: string): number {
        let int = 0;
        for (let i = 0; i < 4; i += 1) int |= (tag.charCodeAt(i) & 0xFF) << 8 * (3 - i);
        return int;
    }

    protected async decodeSfntTable<T>(
        { tables }: SfntHeader,
        tableTag: number | string,
        decode: () => T | PromiseLike<T>,
        memoized: Record<number, any> | null = null,
        initialBytes?: number,
    ): Promise<T | null> {
        const tag = typeof tableTag === 'string' ? this.tagUInt32(tableTag) : tableTag,
            record = tables.find((t) => t.tag === tag);
        if (!record) return null;
        const { offset, bytes } = record;
        // check if table has already been decoded and result has been memoized
        if (memoized?.[offset]) {
            return memoized[offset] as T;
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
        if (memoized) memoized[offset] = decoded;
        // return decoded table
        return decoded;
    }

    protected async decodeLocalizedNames(header: SfntHeader, memo: Record<number, any> | null = null) {
        // decode 'name' table for this subfont
        const name = await this.decodeSfntTable(header, 'name', this.nameTable, memo);
        // throw error if font does not have a 'name' table
        if (!name) throw new Error("Font does not include required 'name' table");
        // decode 'ltag' table if present
        const ltag = await this.decodeSfntTable(header, 'ltag', this.ltagTable, memo);
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

    private async* decodeSfntSystemFonts(
        header: SfntHeader,
        match?: string[],
        memoized?: Record<number, any>,
    ): AsyncGenerator<SystemFont> {
        // decode localized 'name' table
        const names = await this.decodeLocalizedNames(header, memoized),
            // decode 'OS/2' table
            os2 = await this.decodeSfntTable(header, 'OS/2', this.os2Table, memoized),
            // decode 'head' table
            head = await this.decodeSfntTable(header, 'head', this.headTable, memoized),
            // determine font family name and font style
            { family, style } = getFontStyle(names, os2, head);
        // apply family name filter if provided
        if (!family || (match && !match.includes(family))) return;
        // decode 'cmap' table
        const cmap = await this.decodeSfntTable(header, 'cmap', this.cmapTable, memoized, 4);
        // code point coverage cannot be determined if font does not contain a 'cmap' table
        if (!cmap) return;
        const { filePath } = this,
            // determine code point coverage
            coverage = cmapCoverage(cmap),
            // decode 'fvar' table if present
            fvar = await this.decodeSfntTable(header, 'fvar', this.fvarTable, memoized);
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
                    filePath,
                    family,
                    coverage,
                    style: extendFontStyle(style, axes, names[sfNameID]!, coords),
                    fvarInstance: { coords, defscore },
                };
            }
        } else {
            yield {
                filePath,
                family,
                style,
                coverage,
            };
        }
    }

    /**
     * Decode the font file and extract system font info
     * @param match - optional array of font family names to match
     */
    async decodeFileFonts(match?: string[]): Promise<SystemFont[]> {
        try {
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
                    for await (const font of this.decodeSfntSystemFonts(header, match)) {
                        fonts.push(font);
                    }
                    break;
                }
                // 'ttcf'
                case 0x74746366: {
                    // decode ttc subfont headers
                    const headers = await this.ttcHeaders(),
                        // initialize lookup to memoize decoded tables
                        memo: Record<number, any> = {};
                    // loop through ttc subfonts
                    for (const header of headers) {
                        // extract system font info from the subfont
                        for await (const font of this.decodeSfntSystemFonts(header, match, memo)) {
                            fonts.push({ ...font, ttcSubfont: header });
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
                case 0x00010000: { // true type outlines
                    // decode sfnt font header
                    const header = await this.sfntHeader();
                    yield (await decoder.call(this, header, null));
                    break;
                }
                // 'ttcf'
                case 0x74746366: {
                    // create memo cache
                    const memo: Record<number, any> = {};
                    // decode ttc subfont headers
                    for (const header of (await this.ttcHeaders())) {
                        yield (await decoder.call(this, header, memo));
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