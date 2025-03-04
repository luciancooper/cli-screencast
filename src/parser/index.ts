import type {
    ScreenData, ParsedScreenData, CaptureData, Title, CursorState, TerminalLine, ParsedCaptureData,
} from '../types';
import parse, { type ParseContext, type ParseState } from './parse';
import { resolveTitle } from './title';
import * as serialize from './serialize';
import { clone } from './utils';

export function parseScreen({
    content,
    tabSize,
    columns,
    rows,
    ...opts
}: ScreenData): ParsedScreenData {
    const { cursorHidden, cursor, ...state } = parse({
        columns,
        rows,
        tabSize,
    }, {
        lines: [],
        cursor: { line: 0, column: 0 },
        cursorHidden: opts.cursorHidden,
        title: resolveTitle(opts.windowTitle, opts.windowIcon),
        style: { props: 0, fg: 0, bg: 0 },
        savedCursor: { line: 0, column: 0, style: { props: 0, fg: 0, bg: 0 } },
    }, content);
    return {
        columns,
        rows,
        ...state,
        cursor: !cursorHidden ? cursor : null,
    };
}

export function parseCapture({
    writes,
    endDelay,
    tabSize,
    columns,
    rows,
}: CaptureData): ParsedCaptureData {
    const context: ParseContext = { columns, rows, tabSize },
        initialCursor: CursorState = { line: 0, column: 0, visible: true },
        state: ParseState = {
            lines: [],
            cursor: { line: initialCursor.line, column: initialCursor.column },
            cursorHidden: !initialCursor.visible,
            title: null,
            style: { props: 0, fg: 0, bg: 0 },
            savedCursor: { line: 0, column: 0, style: { props: 0, fg: 0, bg: 0 } },
        },
        data: ParsedCaptureData = {
            columns,
            rows,
            content: [],
            cursor: [],
            title: [],
            duration: NaN,
        };
    let lastContent: { time: number, serialized: string, state: TerminalLine[] } = {
            time: 0,
            serialized: serialize.lines([]),
            state: [],
        },
        lastCursor: { time: number, serialized: string, state: CursorState } = {
            time: 0,
            serialized: serialize.cursor(initialCursor),
            state: initialCursor,
        },
        lastTitle: { time: number, serialized: string, state: Title | null } = {
            time: 0,
            serialized: serialize.title(state.title),
            state: state.title,
        },
        time = 0;
    // loop through all writes
    for (const { content, delay } of writes) {
        const wtime = time + delay;
        // parse this write
        parse(context, state, content);
        // push content
        const slines = serialize.lines(state.lines);
        // compare updated content lines to the last content lines
        if (lastContent.serialized !== slines) {
            if (wtime > lastContent.time) {
                data.content.push({ time: lastContent.time, endTime: wtime, lines: lastContent.state });
            }
            lastContent = { time: wtime, serialized: slines, state: clone(state.lines) };
        }
        // push cursor
        const cursor = { ...state.cursor, visible: !state.cursorHidden },
            scursor = serialize.cursor(cursor);
        // compare updated cursor location to the last cursor location
        if (lastCursor.serialized !== scursor) {
            if (wtime > lastCursor.time) {
                data.cursor.push({ time: lastCursor.time, endTime: wtime, ...lastCursor.state });
            }
            lastCursor = { time: wtime, serialized: scursor, state: cursor };
        }
        // push title
        const stitle = serialize.title(state.title);
        // compare updated title to the last title
        if (lastTitle.serialized !== stitle) {
            if (wtime > lastTitle.time && lastTitle.state) {
                data.title.push({ time: lastTitle.time, endTime: wtime, ...lastTitle.state });
            }
            lastTitle = { time: wtime, serialized: stitle, state: clone(state.title) };
        }
        // update time counter
        time += delay;
    }
    // final duration
    time += endDelay;
    // add last content keyframe
    if (time > lastContent.time) {
        data.content.push({ time: lastContent.time, endTime: time, lines: lastContent.state });
    }
    // add last cursor keyframe if cursor is visible or if keyframes array is not empty
    if (time > lastCursor.time) {
        data.cursor.push({ time: lastCursor.time, endTime: time, ...lastCursor.state });
    }
    // add last title keyframe if title is not empty
    if (time > lastTitle.time && lastTitle.state) {
        data.title.push({ time: lastTitle.time, endTime: time, ...lastTitle.state });
    }
    // set data duration
    data.duration = time;
    // return data
    return data;
}

export { expandStyleProps } from './style';