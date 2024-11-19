import type { CursorState, ParsedCaptureData, KeyFrame, ParsedFrame } from '@src/types';
import { processCursorFrames, extractCaptureFrames } from '@src/frames';
import { makeLine, makeKeyFrames, makeCursorFrames } from './helpers/objects';

describe('processCursorFrames', () => {
    test('handles array of empty frames', () => {
        expect(processCursorFrames([], false)).toHaveLength(0);
    });

    test('scrubs insignificant visibility blips', () => {
        expect(processCursorFrames(makeCursorFrames([
            // [ ][_____][ ][_____][ ]
            [30, 0], [200, 1,, 1], [25, 0,, 2], [175, 1], [20, 0],
        ]), false)).toEqual<KeyFrame<CursorState>[]>(makeCursorFrames([
            // [_][_____][_____]
            [30], [200,,,1], [220,,,2],
        ]));
    });

    test('scrubs pairs of adjacent insignificant visibility blips', () => {
        expect(processCursorFrames(makeCursorFrames([
            // [_][ ][_____][ ][_][     ][_][ ]
            [20], [30, 0,, 1], [200, 1], [25, 0], [35, 1,, 2], [100, 0], [25, 1], [5, 0],
        ]), false)).toEqual<KeyFrame<CursorState>[]>(makeCursorFrames([
            // [_][_____][_][     ]
            [20], [255,,, 1], [35,,,2], [130, 0],
        ]));
    });

    test('scrubs spans of several adjacent insignificant visibility changes', () => {
        expect(processCursorFrames(makeCursorFrames([
            // [ ][_][ ][_____][ ][_][ ][_____][ ][_][ ] --> [_____]
            [20, 0], [30, 1], [10, 0], [200, 1], [15, 0], [5, 1], [15, 0], [100, 1], [15, 0], [15, 1], [15, 0],
        ]), false)).toEqual<KeyFrame<CursorState>[]>(makeCursorFrames([[440, 1]]));
    });

    test('merges long sequences of insignificant cursor visibility spans', () => {
        expect(processCursorFrames(makeCursorFrames([
            // [_][  ][_][  ][_] --> [     ]
            [20], [30, 0], [20, 1], [30, 0], [20, 1],
        ]), false)).toEqual<KeyFrame<CursorState>[]>(makeCursorFrames([[120, 0]]));
    });

    describe('cursor blink', () => {
        test('calculates blink animation on visible cursor spans', () => {
            expect(processCursorFrames(makeCursorFrames([
                [2400],
            ]), true)).toEqual<KeyFrame<CursorState>[]>(makeCursorFrames([
                [500], [500, 0], [500, 1], [500, 0], [400, 1],
            ]));
        });

        test('resets blink animation when cursor moves', () => {
            expect(processCursorFrames(makeCursorFrames([
                [800], [800,,, 1],
            ]), true)).toEqual<KeyFrame<CursorState>[]>(makeCursorFrames([
                [500], [300, 0], [500, 1,, 1], [300, 0],
            ]));
        });

        test('merges blink animation into surrounding key frames', () => {
            expect(processCursorFrames(makeCursorFrames([
                [400], [900, ,, 1], [300, 0],
            ]), true)).toEqual<KeyFrame<CursorState>[]>(makeCursorFrames([
                [400], [500,,, 1], [700, 0],
            ]));
        });

        test('scrubs insignficant blink span remainders', () => {
            expect(processCursorFrames(makeCursorFrames([
                [1520, 1], [300,,, 1],
            ]), true)).toEqual<KeyFrame<CursorState>[]>(makeCursorFrames([
                [500, 1], [500, 0], [520, 1], [300, 1,, 1],
            ]));
        });
    });
});

const makeParsedCaptureData = (
    lines: [ms: number, line: string][],
    cursors: Parameters<typeof makeCursorFrames>[0],
    titles: [ms: number, title?: string][],
): ParsedCaptureData => {
    const [cursor, cursorDuration] = makeCursorFrames(cursors, true),
        // fill content frames
        [content, contentDuration] = makeKeyFrames(lines.map(
            ([ms, line]) => [ms, { lines: [{ index: 0, ...makeLine(line) }] }],
        ), true),
        // fill title frames
        [title, titleDuration] = makeKeyFrames(titles.map(
            ([ms, text]) => [ms, text ? { icon: undefined, text, ...makeLine(text) } : null],
        ), true);
    return {
        columns: 10,
        rows: 5,
        content,
        cursor,
        title,
        duration: Math.max(contentDuration, cursorDuration, titleDuration),
    };
};

const makeScreen = (line: string, cursor: [line: number, column: number] | null, title?: string): ParsedFrame => ({
    lines: [{ index: 0, ...makeLine(line) }],
    cursor: cursor ? { line: cursor[0], column: cursor[1] } : null,
    title: { icon: undefined, text: title, ...makeLine(title) },
});

describe('extractCaptureFrames', () => {
    test('handles empty capture data', () => {
        const data = makeParsedCaptureData([], [], []);
        expect(extractCaptureFrames(data, false)).toHaveLength(0);
    });

    test('splits capture data into discrete screen data frames', () => {
        const data = makeParsedCaptureData(
            [[100, 'content 1'], [100, 'content 2'], [100, 'content 3']],
            [[100,, 0, 9], [100,, 1], [100,, 2]],
            [[100, 'title 1'], [100, 'title 2'], [100, 'title 3']],
        );
        expect(extractCaptureFrames(data, false)).toEqual<KeyFrame<ParsedFrame>[]>(makeKeyFrames([
            [100, makeScreen('content 1', [0, 9], 'title 1')],
            [100, makeScreen('content 2', [1, 9], 'title 2')],
            [100, makeScreen('content 3', [2, 9], 'title 3')],
        ]));
    });

    test('handles overlapping content, cursor, and title frames', () => {
        const data = makeParsedCaptureData(
            [[300, 'content 1'], [300, 'content 2'], [300, 'content 3']],
            [[100, 0], [300, 1], [300,, 1], [200, 0]],
            [[200], [300, 'title 1'], [300, 'title 2']],
        );
        expect(extractCaptureFrames(data, false)).toEqual<KeyFrame<ParsedFrame>[]>(makeKeyFrames([
            [100, makeScreen('content 1', null)],
            [100, makeScreen('content 1', [0, 0])],
            [100, makeScreen('content 1', [0, 0], 'title 1')],
            [100, makeScreen('content 2', [0, 0], 'title 1')],
            [100, makeScreen('content 2', [1, 0], 'title 1')],
            [100, makeScreen('content 2', [1, 0], 'title 2')],
            [100, makeScreen('content 3', [1, 0], 'title 2')],
            [100, makeScreen('content 3', null, 'title 2')],
            [100, makeScreen('content 3', null)],
        ]));
    });

    test('merges adjacent hidden cursor frames', () => {
        const data = makeParsedCaptureData([[1800, 'content']], [
            [200, 1], [200,,,1], [200,,,2],
            [200, 0,, 3], [200,,, 4], [200,,, 5],
            [200, 1,, 6], [200,,, 7], [200,,, 8],
        ], []);
        expect(extractCaptureFrames(data, false)).toEqual<KeyFrame<ParsedFrame>[]>(makeKeyFrames([
            [200, makeScreen('content', [0, 0])],
            [200, makeScreen('content', [0, 1])],
            [200, makeScreen('content', [0, 2])],
            [600, makeScreen('content', null)],
            [200, makeScreen('content', [0, 6])],
            [200, makeScreen('content', [0, 7])],
            [200, makeScreen('content', [0, 8])],
        ]));
    });
});