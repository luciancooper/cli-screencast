/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { resolve as resolvePath } from 'path';
import { resolveTitle } from '@src/parser';
import { GraphemeSet } from '@src/fonts/range';
import extractContentSubsets, { createContentSubsets, type ContentSubsets } from '@src/fonts/content';
import { getSystemFonts } from '@src/fonts/system';
import { fetchGoogleFontMetadata } from '@src/fonts/google';
import type { SfntHeader, SystemFont } from '@src/fonts/types';
import { resolveFonts, embedFontCss, type ResolvedFontData } from '@src/fonts';
import { makeLine } from './helpers/objects';

const FontFiles = {
    CascadiaCode: resolvePath(__dirname, './fonts/CascadiaCode.ttf'),
    CascadiaCodeItalic: resolvePath(__dirname, './fonts/CascadiaCodeItalic.ttf'),
    Menlo: resolvePath(__dirname, './fonts/Menlo.ttc'),
    Monaco: resolvePath(__dirname, './fonts/Monaco.ttf'),
} as const;

const fixtures = {
    frame: {
        title: resolveTitle('abc'),
        lines: [
            { index: 0, ...makeLine('cde', ['efg', { bold: true }]) },
            { index: 0, ...makeLine(['ghi', { bold: true, italic: true }], ['ijk', { italic: true }]) },
        ],
    },
    capture: {
        content: [
            { lines: [{ index: 0, ...makeLine('cde', ['efg', { bold: true }]) }] },
            { lines: [{ index: 0, ...makeLine(['ghi', { bold: true, italic: true }], ['ijk', { italic: true }]) }] },
        ],
        title: [resolveTitle('abc')],
    },
    frames: {
        frames: [{
            title: resolveTitle('abc'),
            lines: [{ index: 0, ...makeLine('cde', ['efg', { bold: true }]) }],
        }, {
            title: resolveTitle('abc'),
            lines: [{ index: 0, ...makeLine(['ghi', { bold: true, italic: true }], ['ijk', { italic: true }]) }],
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
            coverage: 'abcdefghijk',
            subsets: [[0, 'abcde'], [1, 'efg'], [2, 'ijk'], [3, 'ghi']],
        }));
    });

    test('extracts char subsets terminal capture data', () => {
        expect(extractContentSubsets(fixtures.capture)).toEqual<ContentSubsets>(makeExpected({
            coverage: 'abcdefghijk',
            subsets: [[0, 'abcde'], [1, 'efg'], [2, 'ijk'], [3, 'ghi']],
        }));
    });

    test('extracts char subsets terminal frames data', () => {
        expect(extractContentSubsets(fixtures.frames)).toEqual<ContentSubsets>(makeExpected({
            coverage: 'abcdefghijk',
            subsets: [[0, 'abcde'], [1, 'efg'], [2, 'ijk'], [3, 'ghi']],
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
        await expect(getSystemFonts()).resolves.toMatchObject<Record<string, Partial<SystemFont>[]>>({
            'Cascadia Code': [
                { style: { weight: 200, width: 5, slant: 0 }, filePath: FontFiles.CascadiaCode },
                { style: { weight: 300, width: 5, slant: 0 }, filePath: FontFiles.CascadiaCode },
                { style: { weight: 350, width: 5, slant: 0 }, filePath: FontFiles.CascadiaCode },
                { style: { weight: 400, width: 5, slant: 0 }, filePath: FontFiles.CascadiaCode },
                { style: { weight: 600, width: 5, slant: 0 }, filePath: FontFiles.CascadiaCode },
                { style: { weight: 700, width: 5, slant: 0 }, filePath: FontFiles.CascadiaCode },
                { style: { weight: 200, width: 5, slant: 2 }, filePath: FontFiles.CascadiaCodeItalic },
                { style: { weight: 300, width: 5, slant: 2 }, filePath: FontFiles.CascadiaCodeItalic },
                { style: { weight: 350, width: 5, slant: 2 }, filePath: FontFiles.CascadiaCodeItalic },
                { style: { weight: 400, width: 5, slant: 2 }, filePath: FontFiles.CascadiaCodeItalic },
                { style: { weight: 600, width: 5, slant: 2 }, filePath: FontFiles.CascadiaCodeItalic },
                { style: { weight: 700, width: 5, slant: 2 }, filePath: FontFiles.CascadiaCodeItalic },
            ],
            Menlo: [
                { style: { weight: 400, width: 5, slant: 0 }, filePath: FontFiles.Menlo },
                { style: { weight: 700, width: 5, slant: 0 }, filePath: FontFiles.Menlo },
                { style: { weight: 400, width: 5, slant: 2 }, filePath: FontFiles.Menlo },
                { style: { weight: 700, width: 5, slant: 2 }, filePath: FontFiles.Menlo },
            ],
            Monaco: [
                { style: { weight: 400, width: 5, slant: 0 }, filePath: FontFiles.Monaco },
            ],
        });
    });

    test('filters results to match an array of font-family names', async () => {
        const fonts = await getSystemFonts(['Monaco']);
        expect(Object.keys(fonts)).toEqual(['Monaco']);
    });
});

describe('resolveFonts', () => {
    test('returns empty set if content is empty', async () => {
        await expect(resolveFonts('', 'Cascadia Code')).resolves.toStrictEqual<ResolvedFontData>({
            fontFamilies: [],
            fontColumnWidth: expect.toBeUndefined(),
        });
    });

    test('handles generic families or families that are not installed or google fonts', async () => {
        await expect(resolveFonts(fixtures.frame, 'Courier,monospace')).resolves.toStrictEqual<ResolvedFontData>({
            fontFamilies: [{ name: 'monospace', type: 'generic' }],
            fontColumnWidth: expect.toBeUndefined(),
        });
    });

    test('resolves google fonts families', async () => {
        const subset = createContentSubsets(['abc', 'cde', '', '']);
        await expect(resolveFonts(subset, 'Fira Code')).resolves.toEqual<ResolvedFontData>({
            fontFamilies: [{
                name: 'Fira Code',
                type: 'google',
                fonts: [
                    { params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' },
                    { params: 'family=Fira+Code:ital,wght@0,700', chars: 'cde' },
                ],
            }],
            fontColumnWidth: expect.toBeUndefined(),
        });
    });

    test('resolves system font families', async () => {
        const subset = createContentSubsets(['abc', 'cde', 'efg', 'ghi']);
        await expect(resolveFonts(subset, 'Cascadia Code')).resolves.toStrictEqual<ResolvedFontData>({
            fontFamilies: [{
                name: 'Cascadia Code',
                type: 'system',
                fonts: [{
                    data: {
                        filePath: FontFiles.CascadiaCode,
                        style: 'normal',
                        weight: 400,
                        fvar: [['wght', 400]],
                    },
                    chars: 'abc',
                }, {
                    data: {
                        filePath: FontFiles.CascadiaCode,
                        style: 'normal',
                        weight: 700,
                        fvar: [['wght', 700]],
                    },
                    chars: 'cde',
                }, {
                    data: {
                        filePath: FontFiles.CascadiaCodeItalic,
                        style: 'italic',
                        weight: 400,
                        fvar: [['wght', 400]],
                    },
                    chars: 'efg',
                }, {
                    data: {
                        filePath: FontFiles.CascadiaCodeItalic,
                        style: 'italic',
                        weight: 700,
                        fvar: [['wght', 700]],
                    },
                    chars: 'ghi',
                }],
            }],
            fontColumnWidth: expect.toBeNumber(),
        });
    });

    test('uses fallbacks when font families do not support a style', async () => {
        const subset = createContentSubsets(['abcʃ∂∆', '∆∏∑', 'cde', '']);
        await expect(resolveFonts(subset, '"Fira Code", Monaco, monospace')).resolves.toEqual<ResolvedFontData>({
            fontFamilies: [{
                name: 'Fira Code',
                type: 'google',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abcde' }],
            }, {
                name: 'Monaco',
                type: 'system',
                fonts: [{
                    data: {
                        filePath: FontFiles.Monaco,
                        style: 'normal',
                        weight: 400,
                    },
                    chars: 'ʃ∂∆∏∑',
                }],
            }, { name: 'monospace', type: 'generic' }],
            fontColumnWidth: expect.toBeNumber(),
        });
    });

    test('resolves system font families that are ttc font collections', async () => {
        const subset = createContentSubsets(['abc', 'cde', '', '']);
        await expect(resolveFonts(subset, 'Menlo')).resolves.toStrictEqual<ResolvedFontData>({
            fontFamilies: [{
                name: 'Menlo',
                type: 'system',
                fonts: [{
                    data: {
                        filePath: FontFiles.Menlo,
                        style: 'normal',
                        weight: 400,
                        ttcSubfont: expect.any(Object) as SfntHeader,
                    },
                    chars: 'abc',
                }, {
                    data: {
                        filePath: FontFiles.Menlo,
                        style: 'normal',
                        weight: 700,
                        ttcSubfont: expect.any(Object) as SfntHeader,
                    },
                    chars: 'cde',
                }],
            }],
            fontColumnWidth: expect.toBeNumber(),
        });
    });
});

describe('embedFontCss', () => {
    const testData: ResolvedFontData['fontFamilies'] = [{
        name: 'Fira Code',
        type: 'google',
        fonts: [
            { params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' },
            { params: 'family=Fira+Code:ital,wght@0,700', chars: 'def' },
        ],
    }, {
        name: 'Monaco',
        type: 'system',
        fonts: [{
            data: {
                filePath: FontFiles.Monaco,
                style: 'normal',
                weight: 400,
            },
            chars: 'ʃ∆∑',
        }],
    }];

    test('returns null if no fonts are provided', async () => {
        await expect(embedFontCss([])).resolves.toBeNull();
    });

    test('returns null if only generic fonts are provided', async () => {
        await expect(embedFontCss([{ name: 'monospace', type: 'generic' }])).resolves.toBeNull();
    });

    test('embedding for png only returns @font-face css blocks for google fonts', async () => {
        const embedded = (await embedFontCss(testData, true))!;
        expect(embedded.css).toContainOccurrences('@font-face', 2);
        expect(embedded.css).toContainOccurrences('url(https://', 2);
        expect(embedded.fontFamily).toBe('"Fira Code",Monaco,monospace');
    });

    test('embedding for png returns null if only system fonts are present', async () => {
        await expect(embedFontCss(testData.slice(1), true)).resolves.toBeNull();
    });

    test('embeding for svg returns @font-face css blocks for system & google fonts', async () => {
        const embedded = (await embedFontCss(testData, false))!;
        expect(embedded.css).toContainOccurrences('@font-face', 3);
        expect(embedded.css).toContainOccurrences('url(data:font/woff2;charset=utf-8;base64', 3);
        expect(embedded.fontFamily).toMatch(/^sc-[a-z]{12}-1,sc-[a-z]{12}-2,monospace$/);
    });
});