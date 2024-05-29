import { resolveTitle } from '@src/parser';
import { GraphemeSet } from '@src/fonts/range';
import extractContentSubsets, { createContentSubsets, type ContentSubsets } from '@src/fonts/content';
import { getSystemFonts } from '@src/fonts/system';
import { fetchGoogleFontMetadata } from '@src/fonts/google';
import createFontCss from '@src/fonts';
import { makeLine } from './helpers/objects';

const fixtures = {
    frame: {
        title: resolveTitle('abc'),
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
        title: [resolveTitle('abc')],
    },
    frames: {
        frames: [{
            title: resolveTitle('abc'),
            lines: [{ index: 0, ...makeLine('def', ['ghi', { bold: true }]) }],
        }, {
            title: resolveTitle('abc'),
            lines: [{ index: 0, ...makeLine(['jkl', { bold: true, italic: true }], ['mno', { italic: true }]) }],
        }],
    },
};

describe('extractContentSubsets', () => {
    type ReplaceType<T, A, B> = T extends A ? B : T extends object ? { [K in keyof T]: ReplaceType<T[K], A, B> } : T;

    const makeExpected = (cp: ReplaceType<ContentSubsets, GraphemeSet, string>): ContentSubsets => ({
        coverage: GraphemeSet.from(cp.coverage),
        subsets: cp.subsets.map(([ansi, chars]) => [ansi, GraphemeSet.from(chars)]),
    });

    test('extracts codepoint subsets from terminal frame data', () => {
        expect(extractContentSubsets(fixtures.frame)).toEqual<ContentSubsets>(makeExpected({
            coverage: 'abcdefghijklmno',
            subsets: [[0, 'abcdef'], [1, 'ghi'], [2, 'mno'], [3, 'jkl']],
        }));
    });

    test('extracts char subsets terminal capture data', () => {
        expect(extractContentSubsets(fixtures.capture)).toEqual<ContentSubsets>(makeExpected({
            coverage: 'abcdefghijklmno',
            subsets: [[0, 'abcdef'], [1, 'ghi'], [2, 'mno'], [3, 'jkl']],
        }));
    });

    test('extracts char subsets terminal frames data', () => {
        expect(extractContentSubsets(fixtures.frames)).toEqual<ContentSubsets>(makeExpected({
            coverage: 'abcdefghijklmno',
            subsets: [[0, 'abcdef'], [1, 'ghi'], [2, 'mno'], [3, 'jkl']],
        }));
    });
});

describe('fetchGoogleFontMetadata', () => {
    test('fetches metadata for a given Google font', async () => {
        await expect(fetchGoogleFontMetadata('Fira Code')).resolves
            .toMatchObject<{ family: string }>({ family: 'Fira Code' });
    });

    test('handles css style font family properties', async () => {
        await expect(fetchGoogleFontMetadata('"Fira Code", monospace')).resolves
            .toMatchObject<{ family: string }>({ family: 'Fira Code' });
        await expect(fetchGoogleFontMetadata("'Fira Code', monospace")).resolves
            .toMatchObject<{ family: string }>({ family: 'Fira Code' });
    });

    test('returns null if font-family is not on google fonts', async () => {
        await expect(fetchGoogleFontMetadata('monospace')).resolves.toBeNull();
    });
});

describe('getSystemFonts', () => {
    test('finds local system font styles grouped by font-family', async () => {
        await expect(getSystemFonts()).resolves.toMatchObject({
            'Cascadia Code': [
                { style: { weight: 200, width: 5, slant: 0 } },
                { style: { weight: 300, width: 5, slant: 0 } },
                { style: { weight: 350, width: 5, slant: 0 } },
                { style: { weight: 400, width: 5, slant: 0 } },
                { style: { weight: 600, width: 5, slant: 0 } },
                { style: { weight: 700, width: 5, slant: 0 } },
                { style: { weight: 200, width: 5, slant: 2 } },
                { style: { weight: 300, width: 5, slant: 2 } },
                { style: { weight: 350, width: 5, slant: 2 } },
                { style: { weight: 400, width: 5, slant: 2 } },
                { style: { weight: 600, width: 5, slant: 2 } },
                { style: { weight: 700, width: 5, slant: 2 } },
            ],
            Menlo: [
                { style: { weight: 400, width: 5, slant: 0 } },
                { style: { weight: 700, width: 5, slant: 0 } },
                { style: { weight: 400, width: 5, slant: 2 } },
                { style: { weight: 700, width: 5, slant: 2 } },
            ],
            Monaco: [
                { style: { weight: 400, width: 5, slant: 0 } },
            ],
        });
    });

    test('filters results to match an array of font-family names', async () => {
        const fonts = await getSystemFonts(['Monaco']);
        expect(Object.keys(fonts)).toEqual(['Monaco']);
    });
});

describe('createFontCss', () => {
    type FontCSS = Awaited<ReturnType<typeof createFontCss>>;

    const expectedFontCSS = (fontFaceCount: number, columnWidth: boolean) => ({
        css: expect.toContainOccurrences('@font-face', fontFaceCount),
        fontFamily: expect.stringMatching(/^sc-[a-z]{12}-1,monospace$/) as string,
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        fontColumnWidth: columnWidth ? expect.toBeNumber() : expect.toBeUndefined(),
    });

    describe('google fonts', () => {
        test('fetches @font-face css blocks', async () => {
            const subset = createContentSubsets(['abc', 'def', '', '']);
            await expect(createFontCss(subset, 'Fira Code')).resolves.toEqual<FontCSS>(expectedFontCSS(2, false));
        });

        test('uses fallbacks when a font family does not support a style', async () => {
            const subset = createContentSubsets(['abc', '', 'def', '']);
            await expect(createFontCss(subset, 'Fira Code')).resolves.toEqual<FontCSS>(expectedFontCSS(1, false));
        });
    });

    describe('system fonts', () => {
        test('creates @font-face css blocks', async () => {
            const subset = createContentSubsets(['abc', 'def', 'ghi', 'jkl']);
            await expect(createFontCss(subset, 'Cascadia Code')).resolves.toEqual<FontCSS>(expectedFontCSS(4, true));
        });

        test('uses fallbacks when a font family does not support a style', async () => {
            const subset = createContentSubsets(['abc', 'def', 'ghi', '']);
            await expect(createFontCss(subset, 'Monaco')).resolves.toEqual<FontCSS>(expectedFontCSS(1, true));
        });

        test('creates @font-face css blocks from ttc font collections', async () => {
            const subset = createContentSubsets(['abc', 'def', '', '']);
            await expect(createFontCss(subset, 'Menlo')).resolves.toEqual<FontCSS>(expectedFontCSS(2, true));
        });
    });

    test('returns null if font-family is not installed or a google font', async () => {
        await expect(createFontCss(fixtures.frame, 'monospace')).resolves.toStrictEqual<FontCSS>({ css: null });
    });
});