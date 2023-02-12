import type { CmapTable } from './types';
import CodePointRange from './range';

export const cmapEncodingPriority = [
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

export function cmapCoverage(table: CmapTable): CodePointRange {
    switch (table.format) {
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-0-byte-encoding-table
        case 0:
            return CodePointRange.from(
                table.glyphIdArray
                    .map<[number, number]>((gid, char) => [gid, char])
                    .filter(([gid]) => gid !== 0)
                    .map(([, char]) => char),
            );
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-6-trimmed-table-mapping
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-10-trimmed-array
        case 6:
        case 10:
            return CodePointRange.from(
                table.glyphIdArray
                    .map<[number, number]>((gid, offset) => [gid, table.startCharCode + offset])
                    .filter(([gid]) => gid !== 0)
                    .map(([, char]) => char),
            );
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-2-high-byte-mapping-through-table
        case 2: {
            const codePoints: number[] = [];
            for (let firstByte = 0; firstByte < 256; firstByte += 1) {
                const shIndex = table.subHeaderKeys[firstByte]! >> 3,
                    sh = table.subHeaders[shIndex]!,
                    glyphIdOffset = (((shIndex + 1) * 8 + sh.idRangeOffset - 2) - (table.subHeaderCount * 8)) >> 1;
                if (shIndex === 0) {
                    if (firstByte < sh.firstCode || firstByte >= sh.firstCode + sh.entryCount) {
                        continue; // glyph is not defined
                    }
                    const charCode = firstByte,
                        offsetIndex = firstByte - sh.firstCode,
                        glyph = table.glyphIdArray[glyphIdOffset + offsetIndex]!;
                    if (glyph === 0) continue;
                    codePoints.push(charCode);
                } else {
                    const charCodeOffset = firstByte * 256 + sh.firstCode;
                    for (let offsetIndex = 0; offsetIndex < sh.entryCount; offsetIndex += 1) {
                        const charCode = charCodeOffset + offsetIndex,
                            glyph = table.glyphIdArray[glyphIdOffset + offsetIndex]!;
                        if (glyph === 0) continue;
                        codePoints.push(charCode);
                    }
                }
            }
            return CodePointRange.from(codePoints);
        }
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-4-segment-mapping-to-delta-values
        case 4: {
            const codePoints: number[] = [];
            for (let i = 0, n = table.segCount; i < n - 1; i += 1) {
                const start = table.startCodes[i]!,
                    end = table.endCodes[i]! + 1,
                    delta = table.idDeltas[i]!,
                    rangeOffset = table.idRangeOffsets[i]!;
                if (rangeOffset === 0) {
                    for (let char = start; char < end; char += 1) {
                        const glyph = (char + delta);
                        if (glyph !== 0) codePoints.push(char);
                    }
                } else {
                    const partial = (rangeOffset >> 1) - start + i - n;
                    for (let char = start; char < end; char += 1) {
                        const index = char + partial;
                        if (table.glyphIdArray[index] === 0) continue;
                        const glyph = (table.glyphIdArray[index]! + delta);
                        if (glyph !== 0) codePoints.push(char);
                    }
                }
            }
            return CodePointRange.from(codePoints);
        }
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-12-segmented-coverage
        case 12: {
            const ranges: [number, number][] = [];
            for (const { startCharCode, endCharCode, glyphID } of table.groups) {
                const start = glyphID === 0 ? startCharCode + 1 : startCharCode,
                    end = endCharCode + 1;
                if (start < end) ranges.push([start, end]);
            }
            return CodePointRange.fromRanges(ranges);
        }
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-13-many-to-one-range-mappings
        case 13: {
            const ranges: [number, number][] = [];
            for (const { startCharCode, endCharCode, glyphID } of table.groups) {
                if (glyphID === 0) continue;
                ranges.push([startCharCode, endCharCode + 1]);
            }
            return CodePointRange.fromRanges(ranges);
        }
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-8-mixed-16-bit-and-32-bit-coverage
        case 8:
            throw new Error('cmap table format 8 is not supported');
        // https://learn.microsoft.com/en-us/typography/opentype/spec/cmap#format-14-unicode-variation-sequences
        case 14:
            throw new Error('cannot extract code point ranges from cmap table format 14');
        // no default: switch is exaustive
    }
}