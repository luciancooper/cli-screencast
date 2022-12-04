import { applyDefaults } from '@src/options';
import { resolveTitle } from '@src/title';
import fetchFontCss, { fetchFontMetadata, determineFontSubsets } from '@src/fonts';
import { makeLine } from './helpers/objects';

const { palette } = applyDefaults({});

const makeTitle = (text?: string, icon?: string | boolean) => (
    resolveTitle(palette, text, icon)
);

const fixtures = {
    frame: {
        title: makeTitle('abc'),
        lines: [
            { index: 0, ...makeLine('def', ['ghi', { bold: true }]) },
            { index: 0, ...makeLine(['jkl', { bold: true, italic: true }], ['mno', { italic: true }]) },
        ],
    },
    capture: {
        content: [
            { lines: [{ index: 0, ...makeLine('def', ['ghi', { bold: true }]) }] },
            { lines: [{ index: 0, ...makeLine(['jkl', { bold: true, italic: true }], ['mno', { italic: true }]) }] },
        ],
        title: [makeTitle('abc')],
    },
    frames: [{
        title: makeTitle('abc'),
        lines: [{ index: 0, ...makeLine('def', ['ghi', { bold: true }]) }],
    }, {
        title: makeTitle('abc'),
        lines: [{ index: 0, ...makeLine(['jkl', { bold: true, italic: true }], ['mno', { italic: true }]) }],
    }],
};

describe('fetchFontMetadata', () => {
    test('fetches metadata for a given Google font', async () => {
        await expect(fetchFontMetadata('Fira Code')).resolves
            .toMatchObject<{ family: string }>({ family: 'Fira Code' });
    });

    test('handles css style font family properties', async () => {
        await expect(fetchFontMetadata('"Fira Code", monospace')).resolves
            .toMatchObject<{ family: string }>({ family: 'Fira Code' });
        await expect(fetchFontMetadata("'Fira Code', monospace")).resolves
            .toMatchObject<{ family: string }>({ family: 'Fira Code' });
    });

    test('returns null if font-family is not on google fonts', async () => {
        await expect(fetchFontMetadata('monospace')).resolves.toBeNull();
    });
});

describe('determineFontSubsets', () => {
    describe('terminal frame data', () => {
        test('extracts font subsets', () => {
            expect(
                determineFontSubsets(fixtures.frame, ['400', '700', '400i', '700i']),
            ).toEqual<{ styleParam: string, chars: string }[]>([
                { styleParam: ':ital,wght@0,400', chars: 'abcdef' },
                { styleParam: ':ital,wght@0,700', chars: 'ghi' },
                { styleParam: ':ital,wght@1,400', chars: 'mno' },
                { styleParam: ':ital,wght@1,700', chars: 'jkl' },
            ]);
        });

        test('extracts font subsets with limited font styles', () => {
            expect(
                determineFontSubsets(fixtures.frame, ['400', '700']),
            ).toEqual<{ styleParam: string, chars: string }[]>([
                { styleParam: ':ital,wght@0,400', chars: 'abcdefmno' },
                { styleParam: ':ital,wght@0,700', chars: 'ghijkl' },
            ]);
        });
    });

    describe('terminal capture data', () => {
        test('extracts font subsets', () => {
            expect(
                determineFontSubsets(fixtures.capture, ['400', '700', '400i', '700i']),
            ).toEqual<{ styleParam: string, chars: string }[]>([
                { styleParam: ':ital,wght@0,400', chars: 'abcdef' },
                { styleParam: ':ital,wght@0,700', chars: 'ghi' },
                { styleParam: ':ital,wght@1,400', chars: 'mno' },
                { styleParam: ':ital,wght@1,700', chars: 'jkl' },
            ]);
        });

        test('extracts font subsets with limited font styles', () => {
            expect(
                determineFontSubsets(fixtures.capture, ['400', '400i']),
            ).toEqual<{ styleParam: string, chars: string }[]>([
                { styleParam: ':ital,wght@0,400', chars: 'abcdefghi' },
                { styleParam: ':ital,wght@1,400', chars: 'jklmno' },
            ]);
        });
    });

    describe('terminal frames data', () => {
        test('extracts font subsets', () => {
            expect(
                determineFontSubsets(fixtures.frames, ['400', '700', '400i', '700i']),
            ).toEqual<{ styleParam: string, chars: string }[]>([
                { styleParam: ':ital,wght@0,400', chars: 'abcdef' },
                { styleParam: ':ital,wght@0,700', chars: 'ghi' },
                { styleParam: ':ital,wght@1,400', chars: 'mno' },
                { styleParam: ':ital,wght@1,700', chars: 'jkl' },
            ]);
        });

        test('extracts font subsets with limited font styles', () => {
            expect(
                determineFontSubsets(fixtures.frames, ['400', '700i']),
            ).toEqual<{ styleParam: string, chars: string }[]>([
                { styleParam: ':ital,wght@0,400', chars: 'abcdefghimno' },
                { styleParam: ':ital,wght@1,700', chars: 'jkl' },
            ]);
        });
    });
});

describe('fetchFontCss', () => {
    test('fetches font css', async () => {
        await expect(fetchFontCss(fixtures.frame, 'Fira Code').then((css) => typeof css)).resolves.toBe('string');
    });

    test('returns null if font-family is not a google font', async () => {
        await expect(fetchFontCss(fixtures.frame, 'monospace')).resolves.toBeNull();
    });
});