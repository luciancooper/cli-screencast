import type { CmapTable } from './types';
import { CodePointRange } from './range';

export interface CmapEncodingRecord {
    platform: number
    encoding: number
    offset: number
}

const cmapEncodingPriority = [
    // 32-bit subtables
    [3, 10], // Windows Platform - Unicode full repertoire
    [0, 6], // Unicode platform - Unicode full repertoire—for use with subtable format 13
    [0, 4], // Unicode platform - Unicode 2.0 and onwards semantics, Unicode full repertoire
    // 16-bit subtables
    [3, 1], // Windows Platform - Unicode BMP
    [0, 3], // Unicode platform - Unicode 2.0 and onwards semantics, Unicode BMP only
    [0, 2], // Unicode platform - ISO/IEC 10646 semantics (deprecated)
    [0, 1], // Unicode platform - Unicode 1.1 semantics (deprecated)
    [0, 0], // Unicode platform - Unicode 1.0 semantics (deprecated)
];

export function selectCmapRecord(encodingRecords: CmapEncodingRecord[]) {
    // select the proper encoding record
    for (const [platform, encoding] of cmapEncodingPriority) {
        for (const rec of encodingRecords) {
            if (rec.platform === platform && rec.encoding === encoding) {
                return rec;
            }
        }
    }
    throw new Error(
        'Font does not include a supported cmap subtable:'
        + encodingRecords.map(({ platform, encoding, offset }) => (
            `\n * platform: ${platform} encoding: ${encoding} offset: ${offset}`
        )).join(''),
    );
}

export function cmapCoverage(
    { table, varSelectors }: { table: CmapTable, varSelectors?: number[] | null },
    numGlyphs: number,
    advanceWidth: number[],
): CodePointRange {
    const awl = advanceWidth.length;
    let range: CodePointRange;
    switch (table.format) {
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-0-byte-encoding-table
        case 0:
            range = CodePointRange.from(
                table.glyphIdArray
                    .map<[number, number]>((gid, char) => [gid, char])
                    .filter(([gid]) => gid !== 0 && gid < numGlyphs)
                    .map(([gid, char]) => [char, advanceWidth[Math.min(gid, awl - 1)]]),
            );
            break;
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-6-trimmed-table-mapping
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-10-trimmed-array
        case 6:
        case 10:
            range = CodePointRange.from(
                table.glyphIdArray
                    .map<[number, number]>((gid, offset) => [gid, table.startCharCode + offset])
                    .filter(([gid]) => gid !== 0 && gid < numGlyphs)
                    .map(([gid, char]) => [char, advanceWidth[Math.min(gid, awl - 1)]]),
            );
            break;
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-2-high-byte-mapping-through-table
        // adapted from https://github.com/fonttools/fonttools/blob/main/Lib/fontTools/ttLib/tables/_c_m_a_p.py#L460
        case 2: {
            const codePoints: [number, number | undefined][] = [];
            for (let firstByte = 0; firstByte < 256; firstByte += 1) {
                // get subheader index for this first byte
                const shIndex = table.subHeaderKeys[firstByte]! >> 3,
                    // get subheader for this byte
                    sh = table.subHeaders[shIndex]!,
                    // offset to the glyph id array
                    glyphIdOffset = (((shIndex + 1) * 8 + sh.idRangeOffset - 2) - (table.subHeaderCount * 8)) >> 1;
                if (shIndex === 0) {
                    if (firstByte < sh.firstCode || firstByte >= sh.firstCode + sh.entryCount) {
                        continue; // glyph is not defined
                    }
                    const charCode = firstByte,
                        offsetIndex = firstByte - sh.firstCode;
                    let glyph = table.glyphIdArray[glyphIdOffset + offsetIndex]!;
                    if (glyph === 0) continue;
                    glyph = (glyph + sh.idDelta) & 0xFFFF;
                    if (glyph !== 0 && glyph < numGlyphs) {
                        codePoints.push([charCode, advanceWidth[Math.min(glyph, awl - 1)]]);
                    }
                } else {
                    const charCodeOffset = firstByte * 256 + sh.firstCode;
                    for (let offsetIndex = 0; offsetIndex < sh.entryCount; offsetIndex += 1) {
                        const charCode = charCodeOffset + offsetIndex;
                        let glyph = table.glyphIdArray[glyphIdOffset + offsetIndex]!;
                        if (glyph === 0) continue;
                        glyph = (glyph + sh.idDelta) & 0xFFFF;
                        if (glyph !== 0 && glyph < numGlyphs) {
                            codePoints.push([charCode, advanceWidth[Math.min(glyph, awl - 1)]]);
                        }
                    }
                }
            }
            range = CodePointRange.from(codePoints);
            break;
        }
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-4-segment-mapping-to-delta-values
        case 4: {
            const codePoints: [number, number | undefined][] = [];
            for (let i = 0, n = table.segCount; i < n - 1; i += 1) {
                const start = table.startCodes[i]!,
                    end = table.endCodes[i]! + 1,
                    delta = table.idDeltas[i]!,
                    rangeOffset = table.idRangeOffsets[i]!;
                if (rangeOffset === 0) {
                    for (let char = start; char < end; char += 1) {
                        const glyph = (char + delta) & 0xFFFF;
                        if (glyph !== 0 && glyph < numGlyphs) {
                            codePoints.push([char, advanceWidth[Math.min(glyph, awl - 1)]]);
                        }
                    }
                } else {
                    const partial = (rangeOffset >> 1) - start + i - n;
                    for (let char = start; char < end; char += 1) {
                        const index = char + partial;
                        if (table.glyphIdArray[index] === 0) continue;
                        const glyph = (table.glyphIdArray[index]! + delta) & 0xFFFF;
                        if (glyph !== 0 && glyph < numGlyphs) {
                            codePoints.push([char, advanceWidth[Math.min(glyph, awl - 1)]]);
                        }
                    }
                }
            }
            range = CodePointRange.from(codePoints);
            break;
        }
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-12-segmented-coverage
        case 12: {
            const codePoints: [number, number | undefined][] = [];
            for (const { startCharCode, endCharCode, glyphID } of table.groups) {
                for (let c = startCharCode, gid = glyphID; c <= endCharCode; c += 1, gid += 1) {
                    if (gid !== 0 && gid < numGlyphs) {
                        codePoints.push([c, advanceWidth[Math.min(gid, awl - 1)]]);
                    }
                }
            }
            range = CodePointRange.from(codePoints);
            break;
        }
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-13-many-to-one-range-mappings
        case 13: {
            const ranges: [number, number, number | undefined][] = [];
            for (const { startCharCode, endCharCode, glyphID } of table.groups) {
                if (glyphID === 0 || glyphID >= numGlyphs) continue;
                ranges.push([startCharCode, endCharCode + 1, advanceWidth[Math.min(glyphID, awl - 1)]]);
            }
            range = CodePointRange.fromRanges(ranges);
            break;
        }
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-8-mixed-16-bit-and-32-bit-coverage
        case 8:
            throw new Error('cmap table format 8 is not supported');
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-14-unicode-variation-sequences
        case 14:
            throw new Error('cannot extract code point ranges from cmap table format 14');
        // no default: switch is exaustive
    }
    // do not add width values to var selectors
    return varSelectors ? CodePointRange.merge(range, CodePointRange.from(varSelectors.map((c) => [c]))) : range;
}