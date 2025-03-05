import type { ParsedCaptureData, KeyFrame, CursorLocation, CursorState, Title, ParsedFrame } from './types';
import * as serialize from './parser/serialize';

function mergeCursorVisibilitySpans(spans: [ms: number, visible: number][]) {
    // merge consecutive spans with the same opacity value
    for (let i = 0; i < spans.length - 1;) {
        if (spans[i]![1] !== spans[i + 1]![1]) i += 1;
        else spans[i]![0] += spans.splice(i + 1, 1)[0]![0];
    }
}

function scrubCursorVisibilitySpans(spans: [ms: number, visible: number][]) {
    // merge flip loop
    while (spans.length > 1) {
        // track if span has been flipped
        let flipped = false;
        // loop through, flipping insignificant spans
        for (let i = 0; i < spans.length; i += 1) {
            if (spans[i]![0] > 40) continue;
            // find adjacent adjacent insignficant spans
            let [j, min] = [i + 1, i];
            for (; j < spans.length; j += 1) {
                const ms = spans[j]![0];
                if (ms > 40) break;
                if (ms < spans[min]![0]) min = j;
            }
            // number of adjacent insignficant spans
            if (j - i === 2) {
                // 2 insignificant spans next to each other
                const [prev, next] = [i > 0, j < spans.length];
                spans[((prev && next) || (!prev && !next)) ? min : prev ? i : i + 1]![1] ^= 1;
            } else {
                // any other number of insignificant spans next to each other
                spans[min]![1] ^= 1;
            }
            i = j - 1;
            flipped = true;
        }
        // stop if no spans were flipped
        if (!flipped) break;
        // merge adjacent spans
        mergeCursorVisibilitySpans(spans);
    }
}

function reassembleCursorFrames(
    locSpans: [ms: number, line: number, column: number][],
    visibleSpans: [ms: number, visible: number][],
) {
    const locFrames: KeyFrame<{ frame: CursorLocation }>[] = [];
    {
        let time = 0;
        for (const [ms, line, column] of locSpans) {
            locFrames.push({ time, endTime: time + ms, frame: { line, column } });
            time += ms;
        }
    }
    const visibleFrames: KeyFrame<{ frame: { visible: boolean } }>[] = [];
    {
        let time = 0;
        for (const [ms, visible] of visibleSpans) {
            visibleFrames.push({ time, endTime: time + ms, frame: { visible: Boolean(visible) } });
            time += ms;
        }
    }
    const frames: KeyFrame<CursorState>[] = [];
    let [loc, visible] = [locFrames.shift(), visibleFrames.shift()];
    while (loc && visible) {
        const keyFrame = { time: Math.max(loc.time, visible.time), endTime: Math.min(loc.endTime, visible.endTime) };
        frames.push({ ...keyFrame, ...loc.frame, ...visible.frame });
        if (loc.endTime === keyFrame.endTime) loc = locFrames.shift();
        if (visible.endTime === keyFrame.endTime) visible = visibleFrames.shift();
    }
    return frames;
}

export function processCursorFrames(frames: KeyFrame<CursorState>[], blink: boolean): KeyFrame<CursorState>[] {
    // check to ensure there is at least one frame
    if (!frames.length) return [];
    // extract location spans
    const loc: [ms: number, line: number, column: number][] = [];
    {
        const first = frames[0]!;
        let [ms, line, column] = [first.endTime - first.time, first.line, first.column];
        for (let i = 1; i < frames.length; i += 1) {
            const frame = frames[i]!;
            if (line !== frame.line || column !== frame.column) {
                loc.push([ms, line, column]);
                [ms, line, column] = [frame.endTime - frame.time, frame.line, frame.column];
            } else ms += frame.endTime - frame.time;
        }
        loc.push([ms, line, column]);
    }
    // extract visible spans
    let visible: [ms: number, visible: number][] = [];
    {
        const first = frames[0]!;
        let [ms, v] = [first.endTime - first.time, first.visible];
        for (let i = 1; i < frames.length; i += 1) {
            const frame = frames[i]!;
            if (v !== frame.visible) {
                visible.push([ms, Number(v)]);
                [ms, v] = [frame.endTime - frame.time, frame.visible];
            } else ms += frame.endTime - frame.time;
        }
        visible.push([ms, Number(v)]);
    }
    // scrub visibility spans
    scrubCursorVisibilitySpans(visible);
    // weave loc & visible spans back together
    let extracted = reassembleCursorFrames(loc, visible);
    if (blink) {
        // split visible cursor spans into blink segments
        visible = [];
        for (const frame of extracted) {
            if (frame.visible) {
                let [ms, v] = [frame.endTime - frame.time, 1];
                for (; ms > 500; ms -= 500, v ^= 1) visible.push([500, v]);
                visible.push([ms, v]);
            } else visible.push([frame.endTime - frame.time, 0]);
        }
        // merge adjacent spans
        mergeCursorVisibilitySpans(visible);
        // scrub visibility spans
        scrubCursorVisibilitySpans(visible);
        // reassemble
        extracted = reassembleCursorFrames(loc, visible);
    }
    return extracted;
}

function serializeFrame(frame: ParsedFrame) {
    let head = serialize.title(frame.title);
    head &&= `{${head}}`;
    if (frame.cursor) head += serialize.cursor(frame.cursor);
    return [head, serialize.lines(frame.lines)].filter(Boolean).join('\n');
}

export function extractCaptureFrames({ columns, rows, ...capture }: ParsedCaptureData, blink: boolean) {
    // process cursor frames
    const cursorFrames = processCursorFrames(capture.cursor, blink).map<KeyFrame<{ loc: CursorLocation | null }>>(({
        time,
        endTime,
        visible,
        ...loc
    }) => ({ time, endTime, loc: visible ? loc : null }));
    // merge adjacent hidden cursor key frames
    for (let i = 0; i < cursorFrames.length - 1;) {
        const [current, next] = [cursorFrames[i]!, cursorFrames[i + 1]!];
        if (current.endTime === next.time && (!current.loc && !next.loc)) {
            // merge key frames
            current.endTime = next.endTime;
            cursorFrames.splice(i + 1, 1);
        } else i += 1;
    }
    // fill title frames
    const titleFrames: KeyFrame<{ data: Title | null }>[] = [];
    {
        let last = 0;
        for (const { time, endTime, ...data } of capture.title) {
            if (last < time) titleFrames.push({ time: last, endTime: time, data: null });
            titleFrames.push({ time, endTime, data });
            last = endTime;
        }
        if (last < capture.duration) titleFrames.push({ time: last, endTime: capture.duration, data: null });
    }
    const contentFrames = capture.content.slice();
    // extract gif frames
    let content = contentFrames.shift(),
        cursor = cursorFrames.shift(),
        title = titleFrames.shift();
    // initialize output frames array
    const frames: KeyFrame<ParsedFrame & { memoidx?: number }>[] = [],
        // create map of serialized frames to indexes
        memo = new Map<string, number>();
    // move through cursor, title, and content frames
    while (content && cursor && title) {
        const time = Math.max(content.time, cursor.time, title.time),
            endTime = Math.min(content.endTime, cursor.endTime, title.endTime),
            frame: ParsedFrame & { memoidx?: number } = { title: title.data, lines: content.lines, cursor: cursor.loc };
        {
            // serialize frame & check if it can be memoized
            const serialized = serializeFrame(frame);
            if (!memo.has(serialized)) memo.set(serialized, frames.length);
            else frame.memoidx = memo.get(serialized)!;
        }
        // add frame
        frames.push({ time, endTime, ...frame });
        if (content.endTime === endTime) content = contentFrames.shift();
        if (cursor.endTime === endTime) cursor = cursorFrames.shift();
        if (title.endTime === endTime) title = titleFrames.shift();
    }
    return frames;
}