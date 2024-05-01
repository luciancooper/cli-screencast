import { join as joinPath } from 'path';
import FontDecoder from '@src/fonts/decoder';
import { cmapCoverage } from '@src/fonts/cmap';

function decodeCmapFixture(fixture: string) {
    return new FontDecoder({
        filePath: joinPath(__dirname, 'fixtures', fixture),
    }).decodeFirst(async function decode(this: FontDecoder, header) {
        const cmap = await this.decodeSfntTable(header, 'cmap', this.cmapTable, 4),
            maxp = await this.decodeSfntTable(header, 'maxp', this.maxpTable, 6),
            hmtx = (await this.decodeHmtx(header)) ?? [];
        return cmap && maxp && cmapCoverage(cmap, maxp.numGlyphs, hmtx).ranges;
    });
}

describe('code point coverage from decoded cmap table', () => {
    test('cmap subtable format 0', async () => {
        await expect(decodeCmapFixture('cmap0.otf')).resolves.toEqual([
            [52, 55, 1500],
        ]);
    });

    test('cmap subtable format 2', async () => {
        await expect(decodeCmapFixture('cmap2.otf')).resolves.toEqual([
            [52, 55, 1500], [33842, 33845, 1500], [37426, 37429, 1500],
        ]);
    });

    test('cmap subtable format 4', async () => {
        await expect(decodeCmapFixture('cmap4.otf')).resolves.toEqual([
            [501, 600, 1500],
        ]);
    });

    test('cmap subtable format 6', async () => {
        await expect(decodeCmapFixture('cmap6.otf')).resolves.toEqual([
            [34, 37, 1500],
        ]);
    });

    test('cmap subtable format 8', async () => {
        await expect(decodeCmapFixture('cmap8.otf')).rejects.toThrow(
            'cmap table format 8 is not supported',
        );
    });

    test('cmap subtable format 10', async () => {
        await expect(decodeCmapFixture('cmap10.otf')).resolves.toEqual([
            [1086499, 1086502, 1500],
        ]);
    });

    test('cmap subtable format 12', async () => {
        await expect(decodeCmapFixture('cmap12.otf')).resolves.toEqual([
            [233, 234, 1500], [7875, 7876, 1500], [8109, 8110, 1500], [10972, 10973, 1500], [119139, 119140, 1500],
        ]);
    });

    test('cmap subtable format 14', async () => {
        await expect(decodeCmapFixture('cmap14.otf')).resolves.toEqual([
            [32, 33, 600], [8809, 8810, 723], [33446, 33447, 1000], // character code points
            [65024, 65025], [917760, 917762], // variation selections
        ]);
    });
});