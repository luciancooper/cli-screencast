import type { TerminalLine, Title, ScreenData, CaptureData, CaptureFrame } from '@src/types';
import extractCaptureFrames from '@src/frames';

const makeCaptureData = (
    content: [number, number, string][],
    cursor: [number, number, boolean?][],
    title: [number, number, string?][],
): CaptureData => ({
    content: content.map(([time, endTime, line]) => ({
        time,
        endTime,
        lines: [line] as unknown as TerminalLine[],
    })),
    cursor: cursor.map(([time, endTime, hidden = false], i) => ({
        time,
        endTime,
        line: i,
        column: i,
        hidden,
    })),
    title: title.map(([time, endTime, text], i) => ({
        time,
        endTime,
        icon: undefined,
        text,
        columns: 0,
        chunks: [],
    })),
    duration: Math.max(
        ...content.map(([, t]) => t),
        ...cursor.map(([, t]) => t),
        ...title.map(([, t]) => t),
    ),
});

const makeScreen = (content: string, cursor: number, title?: string): ScreenData => ({
    lines: [content] as unknown as TerminalLine[],
    cursor: Number.isNaN(cursor)
        ? { line: expect.any(Number) as number, column: expect.any(Number) as number, hidden: true }
        : { line: cursor, column: cursor, hidden: false },
    title: expect.objectContaining({ text: title }) as Title,
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
        expect(extractCaptureFrames(data)).toEqual<CaptureFrame[]>([
            { time: 0, endTime: 1, screen: makeScreen('content 1', 0, 'title 1') },
            { time: 1, endTime: 2, screen: makeScreen('content 2', 1, 'title 2') },
            { time: 2, endTime: 3, screen: makeScreen('content 3', 2, 'title 3') },
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
        expect(extractCaptureFrames(data)).toEqual<CaptureFrame[]>([
            { time: 0, endTime: 1, screen: makeScreen('content 1', NaN) },
            { time: 1, endTime: 2, screen: makeScreen('content 1', 0) },
            { time: 2, endTime: 3, screen: makeScreen('content 1', 0, 'title 1') },
            { time: 3, endTime: 4, screen: makeScreen('content 2', 0, 'title 1') },
            { time: 4, endTime: 5, screen: makeScreen('content 2', 1, 'title 1') },
            { time: 5, endTime: 6, screen: makeScreen('content 2', 1, 'title 2') },
            { time: 6, endTime: 7, screen: makeScreen('content 3', 1, 'title 2') },
            { time: 7, endTime: 8, screen: makeScreen('content 3', NaN, 'title 2') },
            { time: 8, endTime: 9, screen: makeScreen('content 3', NaN) },
        ]);
    });
});