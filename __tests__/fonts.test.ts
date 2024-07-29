/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import nock from 'nock';
import { compress as woff2Compress } from 'wawoff2';
import { resolve as resolvePath } from 'path';
import { resolveTitle } from '@src/parser';
import { GraphemeSet } from '@src/fonts/range';
import extractContentSubsets, { createContentSubsets, type ContentSubsets } from '@src/fonts/content';
import { getSystemFonts, resolveSystemFont, embedSystemFont } from '@src/fonts/system';
import { fetchGoogleFontMetadata, resolveGoogleFont, embedGoogleFont, type GoogleFontMetadata } from '@src/fonts/google';
import type { ResolvedFontFamily, ResolvedFontAccumulator, EmbeddedFontAccumulator, SfntHeader, SystemFont } from '@src/fonts/types';
import { resolveFonts, embedFontCss, type ResolvedFontData } from '@src/fonts';
import { makeLine } from './helpers/objects';

jest.mock('wawoff2', () => {
    const originalModule = jest.requireActual<typeof import('wawoff2')>('wawoff2');
    return {
        ...originalModule,
        compress: jest.fn(originalModule.compress),
    };
});

afterEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
});

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

    test('returns null if font-family is not a google font', async () => {
        await expect(fetchGoogleFontMetadata('monospace')).resolves.toBeNull();
    });

    test('returns null on http errors', async () => {
        nock('https://fonts.google.com').get(/^\/metadata\/fonts/).replyWithError('mocked network error');
        await expect(fetchGoogleFontMetadata('Fira Code')).resolves.toBeNull();
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

    test('filters results to match an array of case insensitive font-family names', async () => {
        const fonts = Object.keys(await getSystemFonts(['Monaco', 'cascadia code']));
        expect(fonts).toHaveLength(2);
        expect(fonts).toEqual(expect.arrayContaining(['Monaco', 'Cascadia Code']));
    });
});

describe('resolveGoogleFont', () => {
    let meta: Record<string, GoogleFontMetadata | null>;

    beforeAll(async () => {
        meta = {
            'Ubuntu Mono': await fetchGoogleFontMetadata('Ubuntu Mono'),
            'Fira Code': await fetchGoogleFontMetadata('Fira Code'),
        };
    });

    test('content coverage is empty', async () => {
        const resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] },
            subset = createContentSubsets(['']);
        await resolveGoogleFont(resolved, subset, meta['Ubuntu Mono']!);
        expect(resolved.families).toStrictEqual<ResolvedFontFamily[]>([
            { name: 'Ubuntu Mono', type: 'google', fonts: [] },
        ]);
    });

    test('google font family supports multiple styles', async () => {
        const resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] };
        let subset = createContentSubsets(['abc', 'cde', '', '']);
        subset = await resolveGoogleFont(resolved, subset, meta['Ubuntu Mono']!);
        expect(subset.coverage.empty()).toBe(true);
        expect(resolved.families).toStrictEqual<ResolvedFontFamily[]>([{
            name: 'Ubuntu Mono',
            type: 'google',
            fonts: [
                { params: 'family=Ubuntu+Mono:ital,wght@0,400', chars: 'abc' },
                { params: 'family=Ubuntu+Mono:ital,wght@0,700', chars: 'cde' },
            ],
        }]);
    });

    test('content coverage only partially overlaps with font coverage', async () => {
        const resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] };
        let subset = createContentSubsets(['abc', '∆∏∑', 'cde', '']);
        subset = await resolveGoogleFont(resolved, subset, meta['Fira Code']!);
        expect(subset.coverage.string()).toBe('∆∏∑');
        expect(resolved.families).toStrictEqual<ResolvedFontFamily[]>([{
            name: 'Fira Code',
            type: 'google',
            fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abcde' }],
        }]);
    });
});

describe('resolveSystemFont', () => {
    let systemFonts: Record<string, SystemFont[]>;

    beforeAll(async () => {
        systemFonts = await getSystemFonts();
    });

    test('content coverage is empty', async () => {
        const resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] },
            subset = createContentSubsets(['']);
        await resolveSystemFont(resolved, subset, { name: 'Monaco', fonts: systemFonts['Monaco']! });
        expect(resolved.families).toStrictEqual<ResolvedFontFamily[]>([
            { name: 'Monaco', type: 'system', fonts: [] },
        ]);
    });

    test('content coverage does not overlap with font', async () => {
        const resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] };
        let subset = createContentSubsets(['⊕⊖⊗⊘']);
        subset = await resolveSystemFont(resolved, subset, { name: 'Monaco', fonts: systemFonts['Monaco']! });
        expect(resolved.families).toStrictEqual<ResolvedFontFamily[]>([
            { name: 'Monaco', type: 'system', fonts: [] },
        ]);
        expect(subset.coverage.string()).toBe('⊕⊖⊗⊘');
    });

    test('system font family only supports one style', async () => {
        const resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] };
        let subset = createContentSubsets(['abc', 'cde']);
        subset = await resolveSystemFont(resolved, subset, { name: 'Monaco', fonts: systemFonts['Monaco']! });
        expect(resolved.families).toStrictEqual<ResolvedFontFamily[]>([{
            name: 'Monaco',
            type: 'system',
            fonts: [{
                data: {
                    filePath: FontFiles.Monaco,
                    style: 'normal',
                    weight: 400,
                },
                chars: 'abcde',
            }],
        }]);
        expect(subset.coverage.empty()).toBe(true);
    });

    test('content coverage only partially overlaps with font coverage', async () => {
        const resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] };
        let subset = createContentSubsets(['abc⊕⊖', '⊗', 'cde⊘']);
        subset = await resolveSystemFont(resolved, subset, {
            name: 'Cascadia Code',
            fonts: systemFonts['Cascadia Code']!,
        });
        expect(resolved.families).toStrictEqual<ResolvedFontFamily[]>([{
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
                    filePath: FontFiles.CascadiaCodeItalic,
                    style: 'italic',
                    weight: 400,
                    fvar: [['wght', 400]],
                },
                chars: 'cde',
            }],
        }]);
        expect(subset.coverage.string()).toBe('⊕⊖⊗⊘');
    });

    test('system font family is a ttc font collection', async () => {
        const resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] },
            subset = createContentSubsets(['abc', 'cde']);
        await resolveSystemFont(resolved, subset, { name: 'Menlo', fonts: systemFonts['Menlo']! });
        expect(resolved.families).toStrictEqual<ResolvedFontFamily[]>([{
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
        }]);
    });
});

describe('resolveFonts', () => {
    test('returns empty set if content is empty', async () => {
        await expect(resolveFonts('', 'Cascadia Code')).resolves.toStrictEqual<ResolvedFontData>({
            fontFamilies: [],
            fullCoverage: true,
            fontColumnWidth: expect.toBeUndefined(),
        });
    });

    test('handles generic families or families that are not installed or google fonts', async () => {
        await expect(resolveFonts(fixtures.frame, 'Courier,monospace')).resolves.toStrictEqual<ResolvedFontData>({
            fontFamilies: [
                { name: 'Courier', type: null },
                { name: 'monospace', type: 'generic' },
            ],
            fullCoverage: false,
            fontColumnWidth: expect.toBeUndefined(),
        });
    });

    test('resolves both google and system fonts', async () => {
        const subset = createContentSubsets(['abcϕ', 'cdeβδλϖ', 'efgϖ', 'ghiλμσϷ']);
        await expect(
            resolveFonts(subset, 'monaco, "cascadia code", "Fira Code", MONOSPACE'),
        ).resolves.toEqual<ResolvedFontData>({
            fontFamilies: [{
                name: 'Monaco',
                type: 'system',
                fonts: [{
                    data: {
                        filePath: FontFiles.Monaco,
                        style: 'normal',
                        weight: 400,
                    },
                    chars: 'abcdefghi',
                }],
            }, {
                name: 'Cascadia Code',
                type: 'system',
                fonts: [{
                    data: {
                        filePath: FontFiles.CascadiaCode,
                        style: 'normal',
                        weight: 700,
                        fvar: [['wght', 700]],
                    },
                    chars: 'βδλ',
                }, {
                    data: {
                        filePath: FontFiles.CascadiaCodeItalic,
                        style: 'italic',
                        weight: 700,
                        fvar: [['wght', 700]],
                    },
                    chars: 'λμσ',
                }],
            }, {
                name: 'Fira Code',
                type: 'google',
                fonts: [
                    { params: 'family=Fira+Code:ital,wght@0,400', chars: 'ϕϖ' },
                    { params: 'family=Fira+Code:ital,wght@0,700', chars: 'ϖϷ' },
                ],
            }, { name: 'monospace', type: 'generic' }],
            fullCoverage: true,
            fontColumnWidth: expect.toBeNumber(),
        });
    });
});

describe('embedGoogleFont', () => {
    test('does not add font family name if no fonts were resolved and full coverage is true', async () => {
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedGoogleFont(embedded, { name: 'Fira Code', fonts: [] }, { forPng: false, fullCoverage: true });
        expect(embedded).toStrictEqual<typeof embedded>({ css: [], family: [] });
    });

    test('adds font family name if full coverage is false', async () => {
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedGoogleFont(embedded, { name: 'Fira Code', fonts: [] }, { forPng: false, fullCoverage: false });
        expect(embedded).toStrictEqual<typeof embedded>({ css: [], family: ['Fira Code'] });
    });

    test('embedding for png returns @font-face css blocks with font url sources', async () => {
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedGoogleFont(embedded, {
            name: 'Fira Code',
            fonts: [
                { params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' },
            ],
        }, { forPng: true, fullCoverage: false });
        expect(embedded).toStrictEqual<typeof embedded>({
            css: [expect.stringMatching(/^@font-face ?\{.*?src: ?url\(https:\/\/.*?\}$/) as string],
            family: ['Fira Code'],
        });
    });

    test('embeding for svg returns @font-face css blocks with embedded woff2 sources', async () => {
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedGoogleFont(embedded, {
            name: 'Fira Code',
            fonts: [
                { params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' },
            ],
        }, { forPng: false, fullCoverage: false });
        expect(embedded).toStrictEqual<typeof embedded>({
            css: [expect.stringMatching(/^@font-face ?\{.*?src: ?url\(data:font\/woff2;.*?\}$/) as string],
            family: ['Fira Code'],
        });
    });

    describe('http errors', () => {
        test('handles thrown errors when fetching css from google api', async () => {
            nock('https://fonts.googleapis.com').get(/^\/css2/).replyWithError('mocked network error');
            const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
            await embedGoogleFont(embedded, {
                name: 'Fira Code',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' }],
            }, { forPng: true, fullCoverage: false });
            expect(embedded).toStrictEqual<typeof embedded>({ css: [], family: ['Fira Code'] });
        });

        test('handles status codes other than 200 when fetching css from google api', async () => {
            nock('https://fonts.googleapis.com').get(/^\/css2/).reply(404);
            const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
            await embedGoogleFont(embedded, {
                name: 'Fira Code',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' }],
            }, { forPng: true, fullCoverage: false });
            expect(embedded).toStrictEqual<typeof embedded>({ css: [], family: ['Fira Code'] });
        });

        test('handles thrown errors when fetching static font files', async () => {
            nock('https://fonts.gstatic.com').get(() => true).replyWithError('mocked network error');
            const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
            await embedGoogleFont(embedded, {
                name: 'Fira Code',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' }],
            }, { forPng: false, fullCoverage: false });
            expect(embedded).toStrictEqual<typeof embedded>({
                css: [expect.stringMatching(/^@font-face ?\{.*?src: ?url\(https:\/\/.*?\}$/) as string],
                family: ['Fira Code'],
            });
        });

        test('handles status codes other than 200 when fetching static font files', async () => {
            nock('https://fonts.gstatic.com').get(() => true).reply(404);
            const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
            await embedGoogleFont(embedded, {
                name: 'Fira Code',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' }],
            }, { forPng: false, fullCoverage: false });
            expect(embedded).toStrictEqual<typeof embedded>({
                css: [expect.stringMatching(/^@font-face ?\{.*?src: ?url\(https:\/\/.*?\}$/) as string],
                family: ['Fira Code'],
            });
        });
    });
});

describe('embedSystemFont', () => {
    const monacoTest: (chars: string) => Omit<Extract<ResolvedFontFamily, { type: 'system' }>, 'type'> = (chars) => ({
        name: 'Monaco',
        fonts: [{
            data: { filePath: FontFiles.Monaco, style: 'normal', weight: 400 },
            chars,
        }],
    });

    test('does not add font family name if no fonts were resolved and full coverage is true', async () => {
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedSystemFont(embedded, { name: 'Monaco', fonts: [] }, { forPng: false, fullCoverage: true });
        expect(embedded).toStrictEqual<typeof embedded>({ css: [], family: [] });
    });

    test('adds font family name if full coverage is false', async () => {
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedSystemFont(embedded, { name: 'Monaco', fonts: [] }, { forPng: false, fullCoverage: false });
        expect(embedded).toStrictEqual<typeof embedded>({ css: [], family: ['Monaco'] });
    });

    test('embeding for svg returns @font-face css blocks', async () => {
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedSystemFont(embedded, monacoTest('abc'), { forPng: false, fullCoverage: true });
        expect(embedded).toStrictEqual<typeof embedded>({
            css: [expect.stringMatching(/^@font-face \{.*?src:url\(data:font\/woff2;charset=utf-8;base64.*?\}$/) as string],
            family: ['Monaco'],
        });
    });

    test('embedding for png returns no css blocks', async () => {
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedSystemFont(embedded, {
            name: 'Monaco',
            fonts: [{
                data: { filePath: FontFiles.Monaco, style: 'normal', weight: 400 },
                chars: 'abc',
            }],
        }, { forPng: true, fullCoverage: true });
        expect(embedded).toStrictEqual<typeof embedded>({ css: [], family: ['Monaco'] });
    });

    test('wawoff2 compression error', async () => {
        (woff2Compress as jest.Mock).mockRejectedValueOnce(new Error('woff2 compression error'));
        const embedded: EmbeddedFontAccumulator = { css: [], family: [] };
        await embedSystemFont(embedded, monacoTest('abc'), { forPng: false, fullCoverage: true });
        expect(embedded).toStrictEqual<typeof embedded>({
            css: [expect.stringMatching(/^@font-face \{.*?src:url\(data:font\/ttf;charset=utf-8;base64.*?\}$/) as string],
            family: ['Monaco'],
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
        fonts: [
            { data: { filePath: FontFiles.Monaco, style: 'normal', weight: 400 }, chars: 'ʃ∆∑' },
        ],
    }, { name: 'Courier', type: null }];

    test('returns font family monospace if no fonts are provided', async () => {
        await expect(embedFontCss({ fontFamilies: [], fullCoverage: true })).resolves.toStrictEqual({
            css: null,
            fontFamily: 'monospace',
        });
    });

    test('includes unresolved fonts if full coverage is false', async () => {
        await expect(embedFontCss({
            fontFamilies: [{ name: 'Courier', type: null }],
            fullCoverage: false,
        })).resolves.toStrictEqual({ css: null, fontFamily: 'Courier,monospace' });
    });

    test('embedding for png only returns @font-face css blocks for google fonts', async () => {
        await expect(embedFontCss({ fontFamilies: testData, fullCoverage: false }, true)).resolves.toStrictEqual({
            css: expect.stringMatching(/^(?:@font-face ?\{.*?src: ?url\(https:\/\/.*?\}\n?){2}$/) as string,
            fontFamily: '"Fira Code",Monaco,Courier,monospace',
        });
    });

    test('embeding for svg returns @font-face css blocks for system & google fonts', async () => {
        await expect(embedFontCss({ fontFamilies: testData, fullCoverage: true }, false)).resolves.toStrictEqual({
            css: expect.stringMatching(/^(?:@font-face ?\{.*?src: ?url\(data:font\/woff2;.*?\}\n?){3}$/) as string,
            fontFamily: '"Fira Code",Monaco,monospace',
        });
    });
});