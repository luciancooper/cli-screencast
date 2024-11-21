import type { PartialExcept, DeepPartial, ScreenData, ParsedScreenData, CaptureData, ParsedCaptureData } from '@src/types';
import { applyDefTerminalOptions } from '@src/options';
import { parseScreen, parseCapture, resolveTitle } from '@src/parser';
import { makeLine, makeCursor, makeKeyFrames } from './helpers/objects';
import * as ansi from './helpers/ansi';

function parseScreenTest({ content, ...options }: PartialExcept<ScreenData, 'content'>) {
    const def = { columns: 50, rows: 10 };
    return parseScreen({ ...applyDefTerminalOptions({ ...def, ...options }, { cursorHidden: true }), content });
}

type PartialParsedScreenData = DeepPartial<ParsedScreenData>;

describe('parseScreen', () => {
    test('resolves initial window title and cursor conditions', () => {
        expect(parseScreenTest({
            content: 'xxxxxxxxxxxxxxxxxxxx\nyyyyyyyyyyyyyyyyyyyy',
            windowTitle: 'title',
            windowIcon: 'icon',
            cursorHidden: false,
        })).toMatchObject<PartialParsedScreenData>({
            lines: [makeLine('xxxxxxxxxxxxxxxxxxxx'), makeLine('yyyyyyyyyyyyyyyyyyyy')],
            title: resolveTitle('title', 'icon'),
            cursor: makeCursor(1, 20),
        });
    });

    test('escapes overwrite initial window title and cursor conditions', () => {
        expect(parseScreenTest({
            content: 'xxxxxxxxx\x1b]2;new title\x07\x1b]1;\x07xxxxxxxxxxx\x1b[?25l',
            windowTitle: 'title',
            windowIcon: 'icon',
            cursorHidden: false,
        })).toMatchObject<PartialParsedScreenData>({
            lines: [makeLine('xxxxxxxxxxxxxxxxxxxx')],
            title: resolveTitle('new title'),
            cursor: null,
        });
    });
});

function parseCaptureTest(spec: PartialExcept<CaptureData, 'writes' | 'endDelay'>) {
    const def = { columns: 50, rows: 10, tabSize: 8 };
    return parseCapture({ ...def, ...spec });
}

type PartialParsedCaptureData = DeepPartial<ParsedCaptureData>;

describe('parseCapture', () => {
    test('parses writes from capture data', () => {
        expect(parseCaptureTest({
            writes: [
                { content: 'xxxxxxxxxxxxxxxxxxxx', delay: 0 },
                { content: `${ansi.eraseLine}${ansi.cursorColumn(0)}yyyyyyyyyy`, delay: 500 },
            ],
            endDelay: 500,
        })).toMatchObject<PartialParsedCaptureData>({
            content: makeKeyFrames([
                [500, { lines: [makeLine('xxxxxxxxxxxxxxxxxxxx')] }],
                [500, { lines: [makeLine('yyyyyyyyyy')] }],
            ]),
            cursor: makeKeyFrames([
                [500, makeCursor(0, 20, true)],
                [500, makeCursor(0, 10, true)],
            ]),
            duration: 1000,
        });
    });

    test('produces cursor state keyframes when cursor is hidden', () => {
        expect(parseCaptureTest({
            writes: [
                { content: '\x1b[?25lxxxxxxxxxxxxxxxxxxxx', delay: 0 },
                { content: 'yyyyyyyyyyyyyyyyyyyy', delay: 500 },
            ],
            endDelay: 500,
        }).cursor).toEqual<ParsedCaptureData['cursor']>(makeKeyFrames([
            [500, makeCursor(0, 20, false)],
            [500, makeCursor(0, 40, false)],
        ]));
    });

    test('changes in cursor visibility are reflected in cursor keyframes', () => {
        expect(parseCaptureTest({
            writes: [
                { content: 'xxxxxxxxxxxxxxxxxxxx', delay: 0 },
                { content: '\x1b[?25l', delay: 500 }, // hide cursor
                { content: ansi.cursorColumn(4), delay: 500 }, // move cursor
                { content: '\x1b[?25h', delay: 500 }, // show cursor
            ],
            endDelay: 500,
        })).toMatchObject<PartialParsedCaptureData>({
            content: [{ time: 0, endTime: 2000, lines: [makeLine('xxxxxxxxxxxxxxxxxxxx')] }],
            cursor: makeKeyFrames([
                [500, makeCursor(0, 20, true)],
                [500, makeCursor(0, 20, false)],
                [500, makeCursor(0, 4, false)],
                [500, makeCursor(0, 4, true)],
            ]),
            duration: 2000,
        });
    });

    test('produces title keyframes when window title and icon changes', () => {
        expect(parseCaptureTest({
            writes: [
                { content: '\x1b]1;shell\x07', delay: 0 },
                { content: '\x1b]2;window title\x07', delay: 500 },
                { content: '\x1b]2;window title without icon\x07\x1b]1;\x07', delay: 500 },
            ],
            endDelay: 500,
        }).title).toEqual<ParsedCaptureData['title']>(makeKeyFrames([
            [500, resolveTitle(undefined, 'shell')],
            [500, resolveTitle('window title', 'shell')],
            [500, resolveTitle('window title without icon')],
        ]));
    });

    test('interleaves content, title, and cursor changes', () => {
        expect(parseCaptureTest({
            writes: [
                { content: '\x1b]2;window title\x07xxxxxxxxxxxxxxxxxxxx', delay: 0 },
                { content: '\r', delay: 500 },
                { content: '\x1b]2;title change\x07', delay: 500 },
                { content: 'yyyyyyyyyy', delay: 500 },
            ],
            endDelay: 500,
        })).toMatchObject<PartialParsedCaptureData>({
            content: makeKeyFrames([
                [1500, { lines: [makeLine('xxxxxxxxxxxxxxxxxxxx')] }],
                [500, { lines: [makeLine('yyyyyyyyyyxxxxxxxxxx')] }],
            ]),
            cursor: makeKeyFrames([
                [500, makeCursor(0, 20, true)],
                [1000, makeCursor(0, 0, true)],
                [500, makeCursor(0, 10, true)],
            ]),
            title: makeKeyFrames([
                [1000, resolveTitle('window title')],
                [1000, resolveTitle('title change')],
            ]),
            duration: 2000,
        });
    });

    test('writes with no delay are merged with the previous write', () => {
        expect(parseCaptureTest({
            writes: [
                { content: 'xxxxxxxxxxxxxxxxxxxx\n', delay: 0 },
                { content: 'yyyyy', delay: 500 },
                { content: 'zzzzz\n', delay: 0 },
            ],
            endDelay: 500,
        })).toMatchObject<PartialParsedCaptureData>({
            content: makeKeyFrames([
                [500, { lines: [makeLine('xxxxxxxxxxxxxxxxxxxx')] }],
                [500, { lines: [makeLine('xxxxxxxxxxxxxxxxxxxx'), makeLine('yyyyyzzzzz')] }],
            ]),
            cursor: makeKeyFrames([
                [500, makeCursor(1, 0, true)],
                [500, makeCursor(2, 0, true)],
            ]),
            duration: 1000,
        });
    });

    test('ignores last write if data has no end delay', () => {
        expect(parseCaptureTest({
            writes: [
                { content: 'xxxxxxxxxxxxxxxxxxxx\n', delay: 0 },
                { content: 'yyyyyyyyyy', delay: 500 },
            ],
            endDelay: 0,
        })).toMatchObject<PartialParsedCaptureData>({
            content: [{ time: 0, endTime: 500, lines: [makeLine('xxxxxxxxxxxxxxxxxxxx')] }],
            cursor: [{ time: 0, endTime: 500, ...makeCursor(1, 0, true) }],
            duration: 500,
        });
    });

    test('first write has delay', () => {
        expect(parseCaptureTest({
            writes: [{ content: 'xxxxxxxxxxxxxxxxxxxx', delay: 500 }],
            endDelay: 500,
        })).toMatchObject<PartialParsedCaptureData>({
            content: makeKeyFrames([
                [500, { lines: [] }],
                [500, { lines: [makeLine('xxxxxxxxxxxxxxxxxxxx')] }],
            ]),
            cursor: makeKeyFrames([
                [500, makeCursor(0, 0, true)],
                [500, makeCursor(0, 20, true)],
            ]),
            duration: 1000,
        });
    });

    test('capture data with no writes and end delay', () => {
        expect(parseCaptureTest({
            writes: [],
            endDelay: 500,
        })).toMatchObject<PartialParsedCaptureData>({
            content: [{ time: 0, endTime: 500, lines: [] }],
            cursor: [{ time: 0, endTime: 500, ...makeCursor(0, 0, true) }],
            title: [],
            duration: 500,
        });
    });

    test('capture data with no writes and no end delay', () => {
        expect(parseCaptureTest({
            writes: [],
            endDelay: 0,
        })).toMatchObject<PartialParsedCaptureData>({
            content: [],
            cursor: [],
            title: [],
            duration: 0,
        });
    });
});