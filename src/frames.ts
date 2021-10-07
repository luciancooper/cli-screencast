import type { CaptureData, CursorLocation, Title, CaptureFrame } from './types';

const hiddenCursor = (): CursorLocation => ({
    hidden: true,
    line: NaN,
    column: NaN,
});

const emptyTitle = (): Title => ({
    icon: undefined,
    text: undefined,
    columns: 0,
    chunks: [],
});

export default function extractCaptureFrames(capture: CaptureData): CaptureFrame[] {
    // fill cursor frames
    const cursorFrames: { time: number, endTime: number, data: CursorLocation }[] = [];
    {
        let last = 0;
        for (const { time, endTime, ...data } of capture.cursor.filter(({ hidden }) => !hidden)) {
            if (last < time) cursorFrames.push({ time: last, endTime: time, data: hiddenCursor() });
            cursorFrames.push({ time, endTime, data });
            last = endTime;
        }
        if (last < capture.duration) cursorFrames.push({ time: last, endTime: capture.duration, data: hiddenCursor() });
    }
    // fill title frames
    const titleFrames: { time: number, endTime: number, data: Title }[] = [];
    {
        let last = 0;
        for (const { time, endTime, ...data } of capture.title) {
            if (last < time) titleFrames.push({ time: last, endTime: time, data: emptyTitle() });
            titleFrames.push({ time, endTime, data });
            last = endTime;
        }
        if (last < capture.duration) titleFrames.push({ time: last, endTime: capture.duration, data: emptyTitle() });
    }
    const contentFrames = capture.content.slice();
    // extract gif frames
    let content = contentFrames.shift(),
        cursor = cursorFrames.shift(),
        title = titleFrames.shift();
    const frames: CaptureFrame[] = [];
    while (content && cursor && title) {
        const time = Math.max(content.time, cursor.time, title.time),
            endTime = Math.min(content.endTime, cursor.endTime, title.endTime),
            screen = { lines: content.lines, cursor: cursor.data, title: title.data };
        frames.push({ time, endTime, screen });
        if (content.endTime === endTime) content = contentFrames.shift();
        if (cursor.endTime === endTime) cursor = cursorFrames.shift();
        if (title.endTime === endTime) title = titleFrames.shift();
    }
    return frames;
}