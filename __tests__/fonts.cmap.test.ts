import { join as joinPath } from 'path';
import FontDecoder from '@src/fonts/decoder';
import { cmapCoverage } from '@src/fonts/cmap';

function decodeCmapFixture(fixture: string) {
    return new FontDecoder({
        filePath: joinPath(__dirname, 'fixtures', fixture),
    }).decodeFirst(function cmap(this: FontDecoder, header) {
        return this.decodeSfntTable(header, 'cmap', async () => cmapCoverage(await this.cmapTable()).ranges, 4);
    });
}

describe('code point coverage from decoded cmap table', () => {
    test('cmap subtable format 0', async () => {
        await expect(decodeCmapFixture('cmap0.otf')).resolves.toEqual([
            [52, 55],
        ]);
    });

    test('cmap subtable format 2', async () => {
        await expect(decodeCmapFixture('cmap2.otf')).resolves.toEqual([
            [52, 55], [33842, 33845], [37426, 37429],
        ]);
    });

    test('cmap subtable format 4', async () => {
        await expect(decodeCmapFixture('cmap4.otf')).resolves.toEqual([
            [100, 500], [501, 1001], [45000, 45101],
        ]);
    });

    test('cmap subtable format 6', async () => {
        await expect(decodeCmapFixture('cmap6.otf')).resolves.toEqual([
            [34, 37],
        ]);
    });

    test('cmap subtable format 8', async () => {
        await expect(decodeCmapFixture('cmap8.otf')).rejects.toThrow(
            'cmap table format 8 is not supported',
        );
    });

    test('cmap subtable format 10', async () => {
        await expect(decodeCmapFixture('cmap10.otf')).resolves.toEqual([
            [1086499, 1086502],
        ]);
    });

    test('cmap subtable format 12', async () => {
        await expect(decodeCmapFixture('cmap12.otf')).resolves.toEqual([
            [233, 234], [7875, 7876], [8109, 8110], [10972, 10973], [119139, 119140],
        ]);
    });

    test('cmap subtable format 14', async () => {
        await expect(decodeCmapFixture('cmap14.otf')).resolves.toEqual([
            [32, 33], [8809, 8810], [33446, 33447], // character code points
            [65024, 65025], [917760, 917762], // variation selections
        ]);
    });
});