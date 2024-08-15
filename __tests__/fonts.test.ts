/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import nock from 'nock';
import { compress as woff2Compress } from 'wawoff2';
import { resolve as resolvePath } from 'path';
import { URL } from 'url';
import { resolveTitle } from '@src/parser';
import { applyLoggingOptions, resetLogLevel } from '@src/logger';
import { GraphemeSet } from '@src/fonts/range';
import extractContentSubsets, { createContentSubsets, type ContentSubsets } from '@src/fonts/content';
import { getSystemFonts, resolveSystemFont, embedSystemFont } from '@src/fonts/system';
import { fetchGoogleFontMetadata, resolveGoogleFont, embedGoogleFont, type GoogleFontMetadata } from '@src/fonts/google';
import type { ResolvedFontFamily, ResolvedFontAccumulator, EmbeddedFontAccumulator, SfntHeader, FontSource, SystemFont } from '@src/fonts/types';
import { resolveFonts, embedFontCss, type ResolvedFontData, type EmbeddedFontData } from '@src/fonts';
import { makeLine } from './helpers/objects';

jest.mock('wawoff2', () => {
    const originalModule = jest.requireActual<typeof import('wawoff2')>('wawoff2');
    return {
        ...originalModule,
        compress: jest.fn(originalModule.compress),
    };
});

beforeAll(() => {
    applyLoggingOptions({ logLevel: 'error' });
});

afterEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
});

afterAll(() => {
    resetLogLevel();
});

const fontFiles = {
    CascadiaCode: {
        file: resolvePath(__dirname, './fonts/CascadiaCode.ttf'),
        installed: true,
    },
    CascadiaCodeItalic: {
        file: resolvePath(__dirname, './fonts/CascadiaCodeItalic.ttf'),
        installed: true,
    },
    Menlo: {
        file: resolvePath(__dirname, './fonts/Menlo.ttc'),
        installed: true,
    },
    Monaco: {
        file: resolvePath(__dirname, './fonts/Monaco.ttf'),
        installed: true,
    },
    Decoder: {
        file: resolvePath(__dirname, './fixtures/decoder.ttf'),
        installed: false,
    },
} satisfies Record<string, FontSource>;

const remoteFonts = {
    Consolas: {
        file: new URL('https://fontlib.s3.amazonaws.com/Consolas/Consola.ttf'),
        specified: true,
    },
    CascadiaCodeRegular: {
        file: new URL('https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCode-Regular.ttf'),
        specified: true,
    },
    CascadiaCodeItalic: {
        file: new URL('https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCode-Italic.ttf'),
        specified: true,
    },
    Courier: {
        file: new URL('https://fontlib.s3.amazonaws.com/Courier/Courier.ttc'),
        specified: true,
    },
} satisfies Record<string, FontSource>;

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
    const resolvedSystemFonts = {
        'Cascadia Code': [
            { style: { weight: 200, width: 5, slant: 0 }, src: fontFiles.CascadiaCode },
            { style: { weight: 300, width: 5, slant: 0 }, src: fontFiles.CascadiaCode },
            { style: { weight: 350, width: 5, slant: 0 }, src: fontFiles.CascadiaCode },
            { style: { weight: 400, width: 5, slant: 0 }, src: fontFiles.CascadiaCode },
            { style: { weight: 600, width: 5, slant: 0 }, src: fontFiles.CascadiaCode },
            { style: { weight: 700, width: 5, slant: 0 }, src: fontFiles.CascadiaCode },
            { style: { weight: 200, width: 5, slant: 2 }, src: fontFiles.CascadiaCodeItalic },
            { style: { weight: 300, width: 5, slant: 2 }, src: fontFiles.CascadiaCodeItalic },
            { style: { weight: 350, width: 5, slant: 2 }, src: fontFiles.CascadiaCodeItalic },
            { style: { weight: 400, width: 5, slant: 2 }, src: fontFiles.CascadiaCodeItalic },
            { style: { weight: 600, width: 5, slant: 2 }, src: fontFiles.CascadiaCodeItalic },
            { style: { weight: 700, width: 5, slant: 2 }, src: fontFiles.CascadiaCodeItalic },
        ],
        Menlo: [
            { style: { weight: 400, width: 5, slant: 0 }, src: fontFiles.Menlo },
            { style: { weight: 700, width: 5, slant: 0 }, src: fontFiles.Menlo },
            { style: { weight: 400, width: 5, slant: 2 }, src: fontFiles.Menlo },
            { style: { weight: 700, width: 5, slant: 2 }, src: fontFiles.Menlo },
        ],
        Monaco: [
            { style: { weight: 400, width: 5, slant: 0 }, src: fontFiles.Monaco },
        ],
    } satisfies Record<string, Partial<SystemFont>[]>;

    test('finds local system font styles grouped by font-family', async () => {
        await expect(getSystemFonts()).resolves.toMatchObject(resolvedSystemFonts);
    });

    test('filters results to match an array of case insensitive font-family names', async () => {
        const fonts = Object.keys(await getSystemFonts({ match: ['Monaco', 'cascadia code'] }));
        expect(fonts).toHaveLength(2);
        expect(fonts).toEqual(expect.arrayContaining(['Monaco', 'Cascadia Code']));
    });

    test('adds additional fonts from local files and urls', async () => {
        await expect(getSystemFonts({
            fonts: [
                fontFiles.Decoder.file,
                fontFiles.Menlo.file,
                remoteFonts.Consolas.file.href,
                remoteFonts.CascadiaCodeRegular.file.href,
                remoteFonts.CascadiaCodeItalic.file.href,
            ],
        })).resolves.toMatchObject({
            ...resolvedSystemFonts,
            Menlo: resolvedSystemFonts.Menlo.map((f) => ({ ...f, src: { ...fontFiles.Menlo, specified: true } })),
            Decoder: [
                { style: { weight: 400, width: 5, slant: 0 }, src: { ...fontFiles.Decoder, specified: true } },
            ],
            Consolas: [
                { style: { weight: 400, width: 5, slant: 0 }, src: remoteFonts.Consolas },
            ],
            'Cascadia Code': [
                { style: { weight: 400, width: 5, slant: 0 }, src: remoteFonts.CascadiaCodeRegular },
                { style: { weight: 400, width: 5, slant: 2 }, src: remoteFonts.CascadiaCodeItalic },
                ...resolvedSystemFonts['Cascadia Code'],
            ],
        });
    });

    test('handles invalid specified fonts', async () => {
        await expect(getSystemFonts({
            fonts: [
                // this is a directory
                __dirname,
                // this is a broken url (file does not exist)
                'https://fontlib.s3.amazonaws.com/CascadiaCode/woff2/static/CascadiaCode.woff2',
                // this is an unsupported woff2 font
                'https://fontlib.s3.amazonaws.com/CascadiaCode/woff2/static/CascadiaCode-Regular.woff2',
                // this file doesn't exist
                resolvePath(__dirname, './fonts/Consola.ttf'),
                // unsupported zip file
                resolvePath(__dirname, './fixtures/empty.zip'),
            ],
        })).resolves.toMatchObject(resolvedSystemFonts);
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
                    src: fontFiles.Monaco,
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
                    src: fontFiles.CascadiaCode,
                    style: 'normal',
                    weight: 400,
                    fvar: [['wght', 400]],
                },
                chars: 'abc',
            }, {
                data: {
                    src: fontFiles.CascadiaCodeItalic,
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
                    src: fontFiles.Menlo,
                    style: 'normal',
                    weight: 400,
                    ttcSubfont: expect.any(Object) as SfntHeader,
                },
                chars: 'abc',
            }, {
                data: {
                    src: fontFiles.Menlo,
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
                        src: fontFiles.Monaco,
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
                        src: fontFiles.CascadiaCode,
                        style: 'normal',
                        weight: 700,
                        fvar: [['wght', 700]],
                    },
                    chars: 'βδλ',
                }, {
                    data: {
                        src: fontFiles.CascadiaCodeItalic,
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
        const embedded: EmbeddedFontAccumulator = { svg: [], png: null, family: [] };
        await embedGoogleFont(embedded, { name: 'Fira Code', fonts: [] }, true);
        expect(embedded).toStrictEqual<typeof embedded>({ svg: [], png: null, family: [] });
    });

    test('adds font family name if full coverage is false', async () => {
        const embedded: EmbeddedFontAccumulator = { svg: [], png: null, family: [] };
        await embedGoogleFont(embedded, { name: 'Fira Code', fonts: [] }, false);
        expect(embedded).toStrictEqual<typeof embedded>({ svg: [], png: null, family: ['Fira Code'] });
    });

    test('@font-face css blocks contain urls for png and embedded woff2 sources for svg', async () => {
        const embedded: EmbeddedFontAccumulator = { svg: [], png: [], family: [] };
        await embedGoogleFont(embedded, {
            name: 'Fira Code',
            fonts: [
                { params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' },
            ],
        }, false);
        expect(embedded).toStrictEqual<typeof embedded>({
            png: [expect.stringMatching(/^@font-face ?\{.*?src: ?url\(https:\/\/.*?\}$/) as string],
            svg: [expect.stringMatching(/^@font-face ?\{.*?src: ?url\(data:font\/woff2;.*?\}$/) as string],
            family: ['Fira Code'],
        });
    });

    describe('http errors', () => {
        test('handles thrown errors when fetching css from google api', async () => {
            nock('https://fonts.googleapis.com').get(/^\/css2/).replyWithError('mocked network error');
            const embedded: EmbeddedFontAccumulator = { png: [], svg: null, family: [] };
            await embedGoogleFont(embedded, {
                name: 'Fira Code',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' }],
            }, false);
            expect(embedded).toStrictEqual<typeof embedded>({ png: [], svg: null, family: ['Fira Code'] });
        });

        test('handles status codes other than 200 when fetching css from google api', async () => {
            nock('https://fonts.googleapis.com').get(/^\/css2/).reply(404);
            const embedded: EmbeddedFontAccumulator = { png: [], svg: null, family: [] };
            await embedGoogleFont(embedded, {
                name: 'Fira Code',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' }],
            }, false);
            expect(embedded).toStrictEqual<typeof embedded>({ png: [], svg: null, family: ['Fira Code'] });
        });

        test('handles thrown errors when fetching static font files', async () => {
            nock('https://fonts.gstatic.com').get(() => true).replyWithError('mocked network error');
            const embedded: EmbeddedFontAccumulator = { svg: [], png: null, family: [] };
            await embedGoogleFont(embedded, {
                name: 'Fira Code',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' }],
            }, false);
            expect(embedded).toStrictEqual<typeof embedded>({
                svg: [expect.stringMatching(/^@font-face ?\{.*?src: ?url\(https:\/\/.*?\}$/) as string],
                png: null,
                family: ['Fira Code'],
            });
        });

        test('handles status codes other than 200 when fetching static font files', async () => {
            nock('https://fonts.gstatic.com').get(() => true).reply(404);
            const embedded: EmbeddedFontAccumulator = { svg: [], png: null, family: [] };
            await embedGoogleFont(embedded, {
                name: 'Fira Code',
                fonts: [{ params: 'family=Fira+Code:ital,wght@0,400', chars: 'abc' }],
            }, false);
            expect(embedded).toStrictEqual<typeof embedded>({
                svg: [expect.stringMatching(/^@font-face ?\{.*?src: ?url\(https:\/\/.*?\}$/) as string],
                png: null,
                family: ['Fira Code'],
            });
        });
    });
});

describe('embedSystemFont', () => {
    type ResolvedSystemFontData = Omit<Extract<ResolvedFontFamily, { type: 'system' }>, 'type'>;

    function fontData(name: string, src: FontSource, chars: string): ResolvedSystemFontData {
        return { name, fonts: [{ data: { src, style: 'normal', weight: 400 }, chars }] };
    }

    let systemFonts: Record<string, SystemFont[]>;

    beforeAll(async () => {
        systemFonts = await getSystemFonts({
            match: ['Courier'],
            fonts: [remoteFonts.Courier.file.href],
        });
    });

    test('does not add font family name if no fonts were resolved and full coverage is true', async () => {
        const embedded: EmbeddedFontAccumulator = { svg: [], png: null, family: [] };
        await embedSystemFont(embedded, { name: 'Monaco', fonts: [] }, true);
        expect(embedded).toStrictEqual<typeof embedded>({ svg: [], png: null, family: [] });
    });

    test('adds font family name if full coverage is false', async () => {
        const embedded: EmbeddedFontAccumulator = { svg: [], png: null, family: [] };
        await embedSystemFont(embedded, { name: 'Monaco', fonts: [] }, false);
        expect(embedded).toStrictEqual<typeof embedded>({ svg: [], png: null, family: ['Monaco'] });
    });

    test('adds @font-face css blocks for svg but not for png', async () => {
        const embedded: EmbeddedFontAccumulator = { svg: [], png: [], family: [] };
        await embedSystemFont(embedded, fontData('Monaco', fontFiles.Monaco, 'abc'), true);
        expect(embedded).toStrictEqual<typeof embedded>({
            svg: [expect.stringMatching(/^@font-face \{.*?src:url\(data:font\/woff2;charset=utf-8;base64.*?\}$/) as string],
            png: [],
            family: ['Monaco'],
        });
    });

    test('embedding for png with specified url sources', async () => {
        const embedded: EmbeddedFontAccumulator = { png: [], svg: null, family: [] };
        await embedSystemFont(embedded, fontData('Consolas', remoteFonts.Consolas, 'abc'), true);
        expect(embedded).toStrictEqual<typeof embedded>({
            png: [expect.stringMatching(/^@font-face \{.*?src:url\(https:.*?\}$/) as string],
            svg: null,
            family: ['Consolas'],
        });
    });

    test('embedding for png with non-installed font file sources', async () => {
        const embedded: EmbeddedFontAccumulator = { png: [], svg: null, family: [] },
            data = fontData('Monaco', { ...fontFiles.Monaco, installed: false, specified: true }, 'abc');
        await embedSystemFont(embedded, data, true);
        expect(embedded).toStrictEqual<typeof embedded>({
            png: [expect.stringMatching(/^@font-face \{.*?src:url\(data:font\/woff2;charset=utf-8;base64.*?\}$/) as string],
            svg: null,
            family: ['Monaco'],
        });
    });

    test('embedding a remote ttc subfont', async () => {
        const embedded: EmbeddedFontAccumulator = { png: null, svg: [], family: [] },
            { style, ttcSubfont } = systemFonts['Courier']![0]!;
        await embedSystemFont(embedded, {
            name: 'Courier',
            fonts: [{
                data: {
                    src: remoteFonts.Courier,
                    style: style.slant ? 'italic' : 'normal',
                    weight: style.weight,
                    ttcSubfont: ttcSubfont!,
                },
                chars: 'abc',
            }],
        }, true);
        expect(embedded).toStrictEqual<typeof embedded>({
            svg: [expect.stringMatching(/^@font-face \{.*?src:url\(data:font\/woff2;charset=utf-8;base64.*?\}$/) as string],
            png: null,
            family: ['Courier'],
        });
    });

    test('http error fetching a remote font', async () => {
        nock('https://fontlib.s3.amazonaws.com').get(() => true).replyWithError('mocked network error');
        const embedded: EmbeddedFontAccumulator = { png: null, svg: [], family: [] };
        await embedSystemFont(embedded, fontData('Consolas', remoteFonts.Consolas, 'abc'), true);
        expect(embedded).toStrictEqual<typeof embedded>({ svg: [], png: null, family: ['Consolas'] });
    });

    test('wawoff2 compression error', async () => {
        (woff2Compress as jest.Mock).mockRejectedValueOnce(new Error('woff2 compression error'));
        const embedded: EmbeddedFontAccumulator = { svg: [], png: null, family: [] };
        await embedSystemFont(embedded, fontData('Monaco', fontFiles.Monaco, 'abc'), true);
        expect(embedded).toStrictEqual<typeof embedded>({
            svg: [expect.stringMatching(/^@font-face \{.*?src:url\(data:font\/ttf;charset=utf-8;base64.*?\}$/) as string],
            png: null,
            family: ['Monaco'],
        });
    });
});

describe('embedFontCss', () => {
    test('returns font family monospace if no fonts are provided', async () => {
        await expect(embedFontCss({
            fontFamilies: [],
            fullCoverage: true,
        }, { svg: true, png: true })).resolves.toStrictEqual<EmbeddedFontData>({
            svg: null,
            png: null,
            fontFamily: 'monospace',
        });
    });

    test('includes unresolved fonts if full coverage is false', async () => {
        await expect(embedFontCss({
            fontFamilies: [{ name: 'Courier', type: null }],
            fullCoverage: false,
        }, { svg: true, png: true })).resolves.toStrictEqual<EmbeddedFontData>({
            svg: null,
            png: null,
            fontFamily: 'Courier,monospace',
        });
    });

    test('embedded css for png only returns @font-face css blocks for google fonts', async () => {
        await expect(embedFontCss({
            fontFamilies: [{
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
                    { data: { src: fontFiles.Monaco, style: 'normal', weight: 400 }, chars: 'ʃ∆∑' },
                ],
            }, { name: 'Courier', type: null }],
            fullCoverage: true,
        }, { svg: true, png: true })).resolves.toStrictEqual<EmbeddedFontData>({
            svg: expect.stringMatching(/^(?:@font-face ?\{.*?src: ?url\(data:font\/woff2;.*?\}\n?){3}$/) as string,
            png: expect.stringMatching(/^(?:@font-face ?\{.*?src: ?url\(https:\/\/.*?\}\n?){2}$/) as string,
            fontFamily: '"Fira Code",Monaco,monospace',
        });
    });
});