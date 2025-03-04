import { ansiRegex, charWidths } from 'tty-strings';
import type {
    Dimensions, TerminalLines, TerminalLine, Title, CursorLocation, AnsiStyle, TextLine, TextChunk,
} from '../types';
import { applySgrEscape } from './sgr';
import { applyTitleEscape } from './title';
import { stylesEqual } from './style';
import { regexChunks } from './utils';

export interface ParseState extends TerminalLines {
    title: Title | null
    cursor: CursorLocation
    cursorHidden: boolean
    style: AnsiStyle
    savedCursor: CursorLocation & { style: Omit<AnsiStyle, 'link'> }
}

export interface ParseContext extends Readonly<Dimensions> {
    readonly tabSize: number
}

const ctrlRegex = String(ansiRegex({ global: false })).slice(1, -2)
    // carriage return not followed by newline
    + '|\\r(?!\\n)'
    // a backspace, form feed, or vertical tab escape
    + '|[\\b\\f\\v]'
    + ')';

function prune(lines: TerminalLine[]) {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i]!;
        if (line.columns || line.chunks.length) break;
        lines.pop();
    }
}

function totalColumns(chunks: TextChunk[]): number {
    const lastChunk = chunks[chunks.length - 1];
    if (!lastChunk) return 0;
    const { x: [x, span] } = lastChunk;
    return x + span;
}

function sliceChunkBefore(chunk: TextChunk, column: number): TextChunk | null {
    const { str, style, x: [x] } = chunk,
        chars = [...charWidths(str)];
    let [substr, cols] = ['', 0];
    for (const [c, w] of chars) {
        if (cols + w > column - x) break;
        substr += c;
        cols += w;
    }
    if (!cols) return null;
    return { str: substr, style, x: [x, cols] };
}

function sliceChunkAfter(chunk: TextChunk, column: number): TextChunk | null {
    const { str, style, x: [x, span] } = chunk,
        chars = [...charWidths(str)];
    let [i, cols] = [0, 0];
    for (const [, w] of chars) {
        if (cols >= column - x) break;
        cols += w;
        i += 1;
    }
    if (i === chars.length) return null;
    const substr = chars.slice(i).map(([c]) => c).join('');
    return { str: substr, style, x: [x + cols, span - cols] };
}

/**
 * Extract a terminal line partial in preparation for a write based on the location of the cursor
 * @param state - screen state upon which content will be written
 * @returns a terminal line partial
 */
export function cursorLinePartial(state: Omit<ParseState, 'title' | 'cursorHidden' | 'style' | 'savedCursor'>): TerminalLine {
    const { lines, cursor } = state;
    if (cursor.line >= lines.length) {
        return { index: 0, columns: cursor.column, chunks: [] };
    }
    const line = lines[cursor.line]!,
        idx = line.chunks.findIndex(({ x: [x, span] }) => cursor.column < x + span);
    if (idx < 0) {
        return { index: line.index, columns: cursor.column, chunks: [...line.chunks] };
    }
    const chunks = line.chunks.slice(0, idx),
        chunk = sliceChunkBefore(line.chunks[idx]!, cursor.column);
    if (chunk) chunks.push(chunk);
    return { index: line.index, columns: cursor.column, chunks };
}

/**
 * Appends content from the end of an overwritten line if it is wider than the line overwriting it
 * @param prev - overwritten line
 * @param next - overwriting line
 * @returns resolved line overwrite
 */
export function overwriteLine<T extends TextLine>(prev: T, next: T): T {
    if (prev.columns <= next.columns) return next;
    const idx = prev.chunks.findIndex(({ x: [x, span] }) => next.columns < x + span),
        chunk = sliceChunkAfter(prev.chunks[idx]!, next.columns),
        append = [...(chunk ? [chunk] : []), ...prev.chunks.slice(idx + 1)],
        chunks = [...next.chunks];
    // check if last chunk in `chunks` and first chunk in `append` should be merged
    if (chunks.length && append.length) {
        const { str: lstr, x: [lx, lspan], style: lstyle } = chunks[chunks.length - 1]!,
            { x: [rx], style: rstyle } = append[0]!;
        if (lx + lspan === rx && stylesEqual(lstyle, rstyle)) {
            // merge chunks
            const { str: rstr, x: [, rspan] } = append.shift()!;
            chunks[chunks.length - 1] = {
                str: lstr + rstr,
                x: [lx, lspan + rspan],
                style: lstyle,
            };
        }
    }
    chunks.push(...append);
    return { ...next, columns: totalColumns(chunks), chunks };
}

function updateTruncatedLineContinuity(lines: TerminalLine[]) {
    if (!lines[0]?.index) return;
    // a wrapped line was truncated, update line wrap continuity indexes
    const delta = lines[0].index;
    for (const line of lines) {
        if (line.index === 0) break;
        line.index -= delta;
    }
}

function updateSubsequentLineContinuity(lines: TerminalLine[], i: number, insertBreak: boolean) {
    let idx = insertBreak ? 0 : lines[i]!.index + 1;
    // reset indexes of subsequent lines
    for (let j = i + 1; j < lines.length; j += 1, idx += 1) {
        const line = lines[j]!;
        if (line.index === 0) break;
        line.index = idx;
    }
}

function parseContent(
    { columns, rows, tabSize }: ParseContext,
    state: Omit<ParseState, 'title' | 'cursorHidden'>,
    content: string,
) {
    const lines: TerminalLine[] = [];
    let line = cursorLinePartial(state);
    const style = { ...state.style };
    for (const [i, contentLine] of content.split(/\r?\n/g).entries()) {
        let [x, str] = [line.columns, ''];
        if (i === 0 && line.chunks.length) {
            const { x: [lx, lspan], style: lstyle } = line.chunks[line.chunks.length - 1]!;
            if (lx + lspan === x && stylesEqual(lstyle, style)) {
                ({ str, x: [x] } = line.chunks.pop()!);
            }
        }
        for (const [c, w] of charWidths(contentLine)) {
            if (w && line.columns + w > columns) {
                const span = Math.min(line.columns, columns) - x;
                if (span) line.chunks.push({ str, style, x: [x, span] });
                lines.push(line);
                line = { index: line.index + 1, columns: 0, chunks: [] };
                [x, str] = [0, ''];
            }
            if (c === '\t') {
                const tw = Math.min(columns - line.columns, tabSize - (line.columns % tabSize));
                line.columns += tw;
                str += ' '.repeat(tw);
            } else {
                line.columns += w;
                str += c;
            }
        }
        const span = line.columns - x;
        if (span) line.chunks.push({ str, style, x: [x, span] });
        lines.push(line);
        line = { index: 0, columns: 0, chunks: [] };
    }
    const { cursor } = state;
    // add any necessary filler lines between the end of current line state & the cursor line index
    for (let n = cursor.line - state.lines.length; n > 0; n -= 1) {
        state.lines.push({ index: 0, columns: 0, chunks: [] });
    }
    // apply new lines
    const merged = [
        ...state.lines.slice(0, cursor.line),
        ...state.lines.slice(cursor.line, cursor.line + lines.length).map((ln, j) => overwriteLine(ln, lines[j]!)),
    ];
    if (state.lines.length - cursor.line > lines.length) {
        merged.push(...state.lines.slice(cursor.line + lines.length));
        // update subsequent line continuity indexes
        updateSubsequentLineContinuity(merged, cursor.line + lines.length - 1, false);
    } else merged.push(...lines.slice(state.lines.length - cursor.line));
    // truncate merged lines and set state
    state.lines = merged.slice(-rows);
    // update line continuity indexes for any truncated lines
    updateTruncatedLineContinuity(state.lines);
    // set updated cursor location
    state.cursor = {
        line: Math.min(cursor.line + lines.length - 1, rows - 1),
        column: lines[lines.length - 1]!.columns,
    };
    prune(state.lines);
}

/**
 * Removes content before the column index from a line
 * @param line - terminal line that is being cleared
 * @param column - column location of the cursor up to which the line will be cleared
 * @returns updated line with content partially cleared
 */
export function clearLineBefore<T extends TextLine>(line: T, column: number): T {
    const idx = line.chunks.findIndex(({ x: [x, span] }) => column < x + span);
    // remove all chunks if idx < 0
    if (idx < 0) return { ...line, columns: 0, chunks: [] };
    // slice index chunk after cursor column
    const chunks: TextChunk[] = [],
        chunk = sliceChunkAfter(line.chunks[idx]!, column);
    if (chunk) chunks.push(chunk);
    chunks.push(...line.chunks.slice(idx + 1));
    // return updated terminal line
    return { ...line, columns: totalColumns(chunks), chunks };
}

/**
 * Removes content after the column index from a line
 * @param line - terminal line that is being cleared
 * @param column - column location of the cursor after which the line will be cleared
 * @returns updated line with content partially cleared
 */
export function clearLineAfter<T extends TextLine>(line: T, column: number): T {
    if (column === 0) return { ...line, columns: 0, chunks: [] };
    const idx = line.chunks.findIndex(({ x: [x, span] }) => column < x + span);
    if (idx < 0) return line;
    const chunks = line.chunks.slice(0, idx),
        chunk = sliceChunkBefore(line.chunks[idx]!, column);
    if (chunk) chunks.push(chunk);
    // return updated terminal line
    return { ...line, columns: totalColumns(chunks), chunks };
}

function parseEscape(context: ParseContext, state: ParseState, esc: string) {
    const { columns, rows } = context,
        { lines, cursor, title } = state;
    // carriage return
    if (esc === '\r') {
        state.cursor = { ...cursor, column: 0 };
        return;
    }
    // backspace
    if (esc === '\b') {
        // moves cursor left 1 column
        const [col, idx] = [cursor.column - 1, cursor.line];
        state.cursor = (col < 0 && idx && lines[idx] && lines[idx]!.index > 0)
            ? { line: idx - 1, column: col + columns }
            : { line: idx, column: Math.max(col, 0) };
        return;
    }
    // form feed / vertical tab
    if (esc === '\f' || esc === '\v') {
        // If cursor is currently on the last line, lines will scroll
        if (cursor.line === rows - 1) {
            state.lines = state.lines.slice(1);
            // update line continuity indexes for truncated lines
            updateTruncatedLineContinuity(state.lines);
        } else {
            // moves cursor down 1 line
            state.cursor = { ...cursor, line: cursor.line + 1 };
        }
        return;
    }
    // osc sequences
    const [, osc] = /(?:\x1b\x5d|\x9d)(.*?)(?:\x1b\x5c|[\x07\x9c])/.exec(esc) ?? [];
    if (typeof osc === 'string') {
        // handle osc
        const [, code, args] = /^(\d+);(.*)$/.exec(osc) ?? [];
        // const code = /^\d+(?=;)/.exec(osc) ?? []; // this also works to get code
        if (code === '0' || code === '1' || code === '2') {
            // osc set window title
            state.title = applyTitleEscape(title, Number(code) as 0 | 1 | 2, args!);
        } else if (code === '8') {
            // osc hyperlink follows this pattern: OSC 8 ; [params] ; [url] ST, so params portion must be removed
            const url = args!.replace(/^[^;]*;/, '');
            // stop if this link does not have params portion
            if (url === args) return;
            // if url is an empty string, then this is a closing hyperlink sequence
            state.style.link = url || undefined;
        }
        return;
    }
    // save cursor DECSC / SCOSC
    if (/^(?:(?:\x1b\x5b|\x9b)s|\x1b7)$/.test(esc)) {
        const { props, fg, bg } = state.style;
        state.savedCursor = { ...cursor, style: { props, fg, bg } };
        return;
    }
    // restore cursor DECRC / SCORC
    if (/^(?:(?:\x1b\x5b|\x9b)u|\x1b8)$/.test(esc)) {
        const { line, column, style } = state.savedCursor;
        state.cursor = { line, column };
        state.style = { ...state.style, ...style };
        return;
    }
    // remove csi prefix
    const csi = esc.replace(/^(?:\x1b\x5b|\x9b)/, '');
    // stop if this is not a csi escape
    if (esc === csi) return;
    // separate final character
    const [args, type] = [csi.slice(0, -1), csi.slice(-1)];
    // sgr escapes
    if (type === 'm') {
        applySgrEscape(state.style, args);
        return;
    }
    // soft terminal reset (DECSTR)
    if (type === 'p' && args === '!') {
        // show cursor
        state.cursorHidden = false;
        // reset sgr attributes
        state.style = { props: 0, fg: 0, bg: 0 };
        // reset saved cursor
        state.savedCursor = { line: 0, column: 0, style: { props: 0, fg: 0, bg: 0 } };
        return;
    }
    // move cursor with `ESC[#;#H` and `ESC[#;#f`
    if (type === 'H' || type === 'f') {
        const m = /^(?:(\d+)?(?:;(\d+)?)?)?$/.exec(args);
        if (m) {
            const line = Math.min(Math.max(Number(m[1] ?? '1'), 1) - 1, rows - 1),
                column = Math.min(Math.max(Number(m[2] ?? '1'), 1) - 1, columns - 1);
            state.cursor = { line, column };
        }
        return;
    }
    // move cursor with `ESC[#A`, `ESC[#B`, `ESC[#C`, `ESC[#D`, `ESC[#E`, `ESC[#F`, & `ESC[#G`
    if (/^[A-G]$/.test(type)) {
        // match delta argument
        const m = /^(\d+)?$/.exec(args);
        // stop if sequence is malformed
        if (!m) return;
        // convert delta into a non-zero integer
        const delta = Math.max(Number(m[1] ?? '1'), 1);
        switch (type as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G') {
            case 'A':
                // moves cursor up # lines
                state.cursor = { ...cursor, line: Math.max(cursor.line - delta, 0) };
                break;
            case 'B':
                // moves cursor down # lines
                state.cursor = { ...cursor, line: Math.min(cursor.line + delta, rows - 1) };
                break;
            case 'C':
                // moves cursor right # columns
                state.cursor = { ...cursor, column: Math.min(cursor.column + delta, columns - 1) };
                break;
            case 'D': {
                // moves cursor left # columns
                let col = cursor.column - delta,
                    idx = cursor.line;
                while (col < 0 && idx && lines[idx] && lines[idx]!.index > 0) {
                    idx -= 1;
                    col += columns;
                }
                state.cursor = { line: idx, column: Math.max(col, 0) };
                break;
            }
            case 'E':
                // moves cursor to beginning of next line, # lines down
                state.cursor = { line: Math.min(cursor.line + delta, rows - 1), column: 0 };
                break;
            case 'F':
                // moves cursor to beginning of previous line, # lines up
                state.cursor = { line: Math.max(cursor.line - delta, 0), column: 0 };
                break;
            case 'G':
                // moves cursor to column #
                state.cursor = { ...cursor, column: delta - 1 };
                break;
            // no default
        }
        return;
    }
    // clear content with `ESC[0J`, `ESC[1J`, `ESC[2J`, `ESC[0K`, `ESC[1K`, `ESC[2K`
    if (type === 'J' || type === 'K') {
        // match argument - DECSED & DECSEL `?` prefix is ignored
        const m = /^\??([0-2])?$/.exec(args);
        // stop if sequence args are malformed
        if (!m) return;
        switch (((m[1] ?? '0') + type) as '0J' | '1J' | '2J' | '0K' | '1K' | '2K') {
            case '0J':
                // clears from cursor to the end of the screen
                if (cursor.line >= lines.length) return;
                // clear after cursor on the current line
                lines[cursor.line] = clearLineAfter(lines[cursor.line]!, cursor.column);
                // remove lines below the cursor line
                lines.splice(cursor.line + 1, lines.length - cursor.line - 1);
                break;
            case '1J':
                // clears from cursor to the beginning of the screen
                if (cursor.line >= lines.length) {
                    // clear all lines
                    state.lines = [];
                    return;
                }
                // clear lines above the cursor line
                for (let i = 0; i < cursor.line; i += 1) lines[i] = { index: 0, columns: 0, chunks: [] };
                // clear before cursor on the current line
                lines[cursor.line] = { ...clearLineBefore(lines[cursor.line]!, cursor.column), index: 0 };
                // update line index continuity of subsequent lines
                updateSubsequentLineContinuity(lines, cursor.line, false);
                break;
            case '2J':
                // clears entire screen
                state.lines = [];
                return;
            case '0K': {
                // clears from the cursor to the end of the line
                if (cursor.line >= lines.length) return;
                lines[cursor.line] = clearLineAfter(lines[cursor.line]!, cursor.column);
                // update line index continuity of subsequent lines
                updateSubsequentLineContinuity(lines, cursor.line, true);
                break;
            }
            case '1K': {
                // clears from cursor to the start of the line
                if (cursor.line >= lines.length) return;
                lines[cursor.line] = clearLineBefore(lines[cursor.line]!, cursor.column);
                // no line index continuity changes
                break;
            }
            case '2K':
                // clears the entire line
                if (cursor.line >= lines.length) return;
                lines[cursor.line] = { ...lines[cursor.line]!, columns: 0, chunks: [] };
                // update line index continuity of subsequent lines
                updateSubsequentLineContinuity(lines, cursor.line, true);
                break;
            // no default - switch is exhaustive
        }
        // prune lines
        prune(lines);
        return;
    }
    // set mode / reset mode sequences
    if (type === 'h' || type === 'l') {
        const m = /^\?([\d;]+)$/.exec(args);
        // stop if this is not a DECSET or DECRST sequence, or if there are no mode args
        if (!m) return;
        const modes = m[1]!.split(';');
        // toggle cursor visibility `CSI ? 25 l` & `CSI ? 25 h`
        if (modes.includes('25')) {
            state.cursorHidden = type === 'l';
        }
    }
    // unsupported escapes fallthrough to here
}

export default function parse(context: ParseContext, state: ParseState, content: string): ParseState {
    for (const [chunk, ctrl] of regexChunks(new RegExp(ctrlRegex, 'g'), content)) {
        if (ctrl) parseEscape(context, state, chunk);
        else parseContent(context, state, chunk);
    }
    return state;
}