import type {
    CaptureData, Title, CursorLocation, TerminalLine, ScreenCastData, ScreenData, TerminalOptions,
} from '../types';
import parse, { type ParseContext, type ParseState } from './parse';
import { resolveTitle } from './title';
import * as serialize from './serialize';
import { clone } from './utils';

export function parseScreen(content: string, opts: Required<TerminalOptions>): ScreenData {
    const { cursorHidden, cursor, ...state } = parse({ ...opts }, {
        lines: [],
        cursor: { line: 0, column: 0 },
        cursorHidden: opts.cursorHidden,
        title: resolveTitle(opts.windowTitle, opts.windowIcon),
    }, content);
    return {
        columns: opts.columns,
        rows: opts.rows,
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
}: CaptureData): ScreenCastData {
    const context: ParseContext = { columns, rows, tabSize },
        state: ParseState = {
            lines: [],
            cursor: { line: 0, column: 0 },
            cursorHidden: false,
            title: resolveTitle(),
        },
        data: ScreenCastData = {
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
        lastCursor: { time: number, loc: CursorLocation | null } = {
            time: 0,
            loc: clone(state.cursor),
        },
        lastTitle: { time: number, serialized: string, state: Title } = {
            time: 0,
            serialized: serialize.title(state.title),
            state: clone(state.title),
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
        const cursor = !state.cursorHidden ? state.cursor : null,
            scursor = serialize.cursor(cursor);
        // compare updated cursor location to the last cursor location
        if (serialize.cursor(lastCursor.loc) !== scursor) {
            if (lastCursor.loc && wtime > lastCursor.time) {
                data.cursor.push({ time: lastCursor.time, endTime: wtime, ...lastCursor.loc });
            }
            lastCursor = { time: wtime, loc: cursor && clone(cursor) };
        }
        // push title
        const stitle = serialize.title(state.title);
        // compare updated title to the last title
        if (lastTitle.serialized !== stitle) {
            if (wtime > lastTitle.time && lastTitle.serialized) {
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
    if (time > lastCursor.time && lastCursor.loc) {
        data.cursor.push({ time: lastCursor.time, endTime: time, ...lastCursor.loc });
    }
    // add last title keyframe if title is not empty
    if (time > lastTitle.time && lastTitle.serialized) {
        data.title.push({ time: lastTitle.time, endTime: time, ...lastTitle.state });
    }
    // set data duration
    data.duration = time;
    // return data
    return data;
}

export { expandAnsiProps } from './ansi';
export { resolveTitle };