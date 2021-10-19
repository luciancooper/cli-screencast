import type { CaptureData, CursorLocation, Title, CaptureKeyFrame } from './types';

const emptyTitle = (): Title => ({
    icon: undefined,
    text: undefined,
    columns: 0,
    chunks: [],
});

export default function extractCaptureFrames(capture: CaptureData): CaptureKeyFrame[] {
    // fill cursor frames
    const cursorFrames: { time: number, endTime: number, loc: CursorLocation | null }[] = [];
    {
        let last = 0;
        for (const { time, endTime, ...loc } of capture.cursor) {
            if (last < time) cursorFrames.push({ time: last, endTime: time, loc: null });
            cursorFrames.push({ time, endTime, loc });
            last = endTime;
        }
        if (last < capture.duration) cursorFrames.push({ time: last, endTime: capture.duration, loc: null });
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
    const frames: CaptureKeyFrame[] = [];
    while (content && cursor && title) {
        const time = Math.max(content.time, cursor.time, title.time),
            endTime = Math.min(content.endTime, cursor.endTime, title.endTime);
        frames.push({
            time,
            endTime,
            title: title.data,
            lines: content.lines,
            cursor: cursor.loc,
        });
        if (content.endTime === endTime) content = contentFrames.shift();
        if (cursor.endTime === endTime) cursor = cursorFrames.shift();
        if (title.endTime === endTime) title = titleFrames.shift();
    }
    return frames;
}