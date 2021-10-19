import type { ScreenData, CaptureData, CaptureKeyFrame } from '@src/types';
import extractCaptureFrames from '@src/frames';
import { makeLine } from './helpers/objects';

const makeCaptureData = (
    content: [number, number, string][],
    cursor: [number, number, boolean?][],
    title: [number, number, string?][],
): CaptureData => ({
    content: content.map(([time, endTime, line]) => ({
        time,
        endTime,
        lines: [{ index: 0, ...makeLine(line) }],
    })),
    cursor: cursor.map(([time, endTime], i) => ({
        time,
        endTime,
        line: i,
        column: i,
    })),
    title: title.map(([time, endTime, text]) => ({
        time,
        endTime,
        icon: undefined,
        text,
        ...makeLine(text),
    })),
    duration: Math.max(
        ...content.map(([, t]) => t),
        ...cursor.map(([, t]) => t),
        ...title.map(([, t]) => t),
    ),
});

const makeScreen = (line: string, cursor: number, title?: string): ScreenData => ({
    lines: [{ index: 0, ...makeLine(line) }],
    cursor: !Number.isNaN(cursor) ? { line: cursor, column: cursor } : null,
    title: { icon: undefined, text: title, ...makeLine(title) },
});

describe('extractCaptureFrames', () => {
    test('splits capture data into discrete screen data frames', () => {
        const data = makeCaptureData([
            [0, 1, 'content 1'],
            [1, 2, 'content 2'],
            [2, 3, 'content 3'],
        ], [[0, 1], [1, 2], [2, 3]], [
            [0, 1, 'title 1'],
            [1, 2, 'title 2'],
            [2, 3, 'title 3'],
        ]);
        expect(extractCaptureFrames(data)).toEqual<CaptureKeyFrame[]>([
            { time: 0, endTime: 1, ...makeScreen('content 1', 0, 'title 1') },
            { time: 1, endTime: 2, ...makeScreen('content 2', 1, 'title 2') },
            { time: 2, endTime: 3, ...makeScreen('content 3', 2, 'title 3') },
        ]);
    });

    test('handles overlapping content, cursor, and title frames', () => {
        const data = makeCaptureData([
            [0, 3, 'content 1'],
            [3, 6, 'content 2'],
            [6, 9, 'content 3'],
        ], [[1, 4], [4, 7]], [
            [2, 5, 'title 1'],
            [5, 8, 'title 2'],
        ]);
        expect(extractCaptureFrames(data)).toEqual<CaptureKeyFrame[]>([
            { time: 0, endTime: 1, ...makeScreen('content 1', NaN) },
            { time: 1, endTime: 2, ...makeScreen('content 1', 0) },
            { time: 2, endTime: 3, ...makeScreen('content 1', 0, 'title 1') },
            { time: 3, endTime: 4, ...makeScreen('content 2', 0, 'title 1') },
            { time: 4, endTime: 5, ...makeScreen('content 2', 1, 'title 1') },
            { time: 5, endTime: 6, ...makeScreen('content 2', 1, 'title 2') },
            { time: 6, endTime: 7, ...makeScreen('content 3', 1, 'title 2') },
            { time: 7, endTime: 8, ...makeScreen('content 3', NaN, 'title 2') },
            { time: 8, endTime: 9, ...makeScreen('content 3', NaN) },
        ]);
    });
});