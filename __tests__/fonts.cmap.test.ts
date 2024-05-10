import { join as joinPath } from 'path';
import FontDecoder from '@src/fonts/decoder';
import { selectCmapRecord, cmapCoverage } from '@src/fonts/cmap';

function decodeSelectionFixture(fixture: string) {
    return new FontDecoder({
        filePath: joinPath(__dirname, 'fixtures', fixture),
    }).decodeFirst(async function decode(this: FontDecoder, header) {
        const records = await this.decodeSfntTable(header, 'cmap', this.cmapEncodingRecords, 4);
        return { records, selection: records && selectCmapRecord(records) };
    });
}

describe('cmap encoding record selection', () => {
    test('select windows platform unicode full repertoire', async () => {
        await expect(decodeSelectionFixture('cmap_subtableselection_1.otf')).resolves.toMatchObject({
            records: [
                { platform: 0, encoding: 3 }, // Unicode 2.0 BMP only
                { platform: 0, encoding: 4 }, // Unicode 2.0 full repertoire
                { platform: 1, encoding: 0 }, // Mac Roman
                { platform: 3, encoding: 1 }, // Windows Unicode BMP
                { platform: 3, encoding: 10 }, // Windows Unicode full repertoire
            ],
            selection: { platform: 3, encoding: 10 }, // Windows Unicode full repertoire
        });
    });

    test('select unicode platform full repertoire', async () => {
        await expect(decodeSelectionFixture('cmap_subtableselection_2.otf')).resolves.toMatchObject({
            records: [
                { platform: 0, encoding: 3 }, // Unicode 2.0 BMP only
                { platform: 0, encoding: 4 }, // Unicode 2.0 full repertoire
                { platform: 1, encoding: 0 }, // Mac Roman
                { platform: 3, encoding: 1 }, // Windows Unicode BMP
            ],
            selection: { platform: 0, encoding: 4 }, // Unicode 2.0 full repertoire
        });
    });

    test('select windows platform unicode BMP', async () => {
        await expect(decodeSelectionFixture('cmap_subtableselection_3.otf')).resolves.toMatchObject({
            records: [
                { platform: 0, encoding: 3 }, // Unicode 2.0 BMP only
                { platform: 1, encoding: 0 }, // Mac Roman
                { platform: 3, encoding: 1 }, // Windows Unicode BMP
            ],
            selection: { platform: 3, encoding: 1 }, // Windows Unicode BMP
        });
    });

    test('select unicode platform BMP only', async () => {
        await expect(decodeSelectionFixture('cmap_subtableselection_4.otf')).resolves.toMatchObject({
            records: [
                { platform: 0, encoding: 3 }, // Unicode 2.0 BMP only
                { platform: 1, encoding: 0 }, // Mac Roman
            ],
            selection: { platform: 0, encoding: 3 }, // Unicode 2.0 BMP only
        });
    });

    test('throws error when no supported unicode subtable is found', async () => {
        await expect(decodeSelectionFixture('cmap_subtableselection_5.otf')).rejects.toThrow(
            'Font does not include a supported cmap subtable:'
            + '\n * platform: 1 encoding: 0', // Mac Roman
        );
    });
});

function decodeCoverageFixture(fixture: string) {
    return new FontDecoder({
        filePath: joinPath(__dirname, 'fixtures', fixture),
    }).decodeFirst(async function decode(this: FontDecoder, header) {
        const cmap = await this.decodeSfntTable(header, 'cmap', this.cmapTable, 4),
            maxp = await this.decodeSfntTable(header, 'maxp', this.maxpTable, 6),
            hmtx = (await this.decodeHmtx(header)) ?? [];
        return cmap && maxp && cmapCoverage(cmap, maxp.numGlyphs, hmtx).ranges;
    });
}

describe('cmap subtable codepoint coverage', () => {
    test('cmap subtable format 0', async () => {
        await expect(decodeCoverageFixture('cmap0.otf')).resolves.toEqual([
            [52, 55, 1500],
        ]);
    });

    test('cmap subtable format 2', async () => {
        await expect(decodeCoverageFixture('cmap2.otf')).resolves.toEqual([
            [52, 55, 1500], [33842, 33845, 1500], [37426, 37429, 1500],
        ]);
    });

    test('cmap subtable format 4', async () => {
        await expect(decodeCoverageFixture('cmap4.otf')).resolves.toEqual([
            [501, 600, 1500],
        ]);
    });

    test('cmap subtable format 6', async () => {
        await expect(decodeCoverageFixture('cmap6.otf')).resolves.toEqual([
            [34, 37, 1500],
        ]);
    });

    test('cmap subtable format 8', async () => {
        await expect(decodeCoverageFixture('cmap8.otf')).rejects.toThrow(
            'cmap table format 8 is not supported',
        );
    });

    test('cmap subtable format 10', async () => {
        await expect(decodeCoverageFixture('cmap10.otf')).resolves.toEqual([
            [1086499, 1086502, 1500],
        ]);
    });

    test('cmap subtable format 12', async () => {
        await expect(decodeCoverageFixture('cmap12.otf')).resolves.toEqual([
            [233, 234, 1500], [7875, 7876, 1500], [8109, 8110, 1500], [10972, 10973, 1500], [119139, 119140, 1500],
        ]);
    });

    test('cmap subtable format 13', async () => {
        // cmap13.ttf file is from opentype.js test files (TestCMAP13.ttf)
        await expect(decodeCoverageFixture('cmap13.ttf')).resolves.toEqual([
            [0x0, 0x80, 2350], // glyph 1
            [0x13A0, 0x13F6, 2350], [0x13F8, 0x13FE, 2350], // glyph 2
            [0x12000, 0x1239A, 2350], // glyph 3
            [0x1FA00, 0x1FA54, 2350], [0x1FA60, 0x1FA6E, 2350], // glyph 4
        ]);
    });

    test('cmap subtable format 14', async () => {
        await expect(decodeCoverageFixture('cmap14.otf')).resolves.toEqual([
            [32, 33, 600], [8809, 8810, 723], [33446, 33447, 1000], // character code points
            [65024, 65025], [917760, 917762], // variation selections
        ]);
    });
});