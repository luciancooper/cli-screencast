import { splitLines, charWidths } from 'tty-strings';
import type { Dimensions, Palette, ScreenData, TerminalLine, TextChunk } from './types';
import parseAnsi, { stylesEqual } from './ansi';
import { regexChunks } from './utils';

export interface ParseContext extends Dimensions {
    tabSize: number
    palette: Palette
}

const ctrlRegex = '\\x1b\\[(?:(?:(?:\\d+)?;(?:\\d+)?)?[Hf]|\\d*[A-G]|6n|[0-2]?[JK]|[SsTu]|(?:\\?(?:25|47|1049)|=[0-7][3-9]?)[hl])';

function prune(lines: TerminalLine[]) {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i]!;
        if (line.columns || line.chunks.length) break;
        lines.pop();
    }
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
export function cursorLinePartial(state: ScreenData): TerminalLine {
    const { lines, cursor } = state;
    if (cursor.line >= lines.length) {
        return { index: 0, columns: cursor.column, chunks: [] };
    }
    const line = lines[cursor.line]!,
        idx = line.chunks.findIndex(({ x: [x, span] }) => cursor.column < x + span);
    if (idx < 0) {
        return { index: 0, columns: cursor.column, chunks: [...line.chunks] };
    }
    const chunks = line.chunks.slice(0, idx),
        chunk = sliceChunkBefore(line.chunks[idx]!, cursor.column);
    if (chunk) chunks.push(chunk);
    return { index: 0, columns: cursor.column, chunks };
}

/**
 * Appends content from the end of an overwritten line if it is wider than the line overwriting it
 * @param prev - overwritten line
 * @param next - overwriting line
 * @returns resolved line overwrite
 */
export function overwriteLine(prev: TerminalLine, next: TerminalLine): TerminalLine {
    if (prev.columns <= next.columns) return next;
    const idx = prev.chunks.findIndex(({ x: [x, span] }) => next.columns < x + span),
        chunk = sliceChunkAfter(prev.chunks[idx]!, next.columns);
    if (chunk) next.chunks.push(chunk);
    next.chunks.push(...prev.chunks.slice(idx + 1));
    next.columns = prev.columns;
    return next;
}

function parseContent({ columns, tabSize, palette }: ParseContext, state: ScreenData, content: string) {
    const lines: TerminalLine[] = [];
    let line = cursorLinePartial(state);
    for (const [i, contentLine] of [...splitLines(content)].entries()) {
        for (const [j, { chunk, style }] of [...parseAnsi(palette, contentLine)].entries()) {
            let [x, str] = [line.columns, ''];
            if (i === 0 && j === 0 && line.chunks.length) {
                const { x: [lx, lspan], style: lstyle } = line.chunks[line.chunks.length - 1]!;
                if (lx + lspan === x && stylesEqual(lstyle, style)) {
                    ({ str, x: [x] } = line.chunks.pop()!);
                }
            }
            for (const [c, w] of charWidths(chunk)) {
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
        }
        lines.push(line);
        line = { index: 0, columns: 0, chunks: [] };
    }
    const { cursor } = state;
    if (cursor.line >= state.lines.length) {
        for (let n = cursor.line - state.lines.length; n > 0; n -= 1) {
            state.lines.push({ index: 0, columns: 0, chunks: [] });
        }
        state.lines.push(...lines);
        const idx = state.lines.length - 1;
        state.cursor = { ...cursor, line: idx, column: state.lines[idx]!.columns };
    } else {
        let idx = cursor.line;
        while (idx < state.lines.length && lines.length) {
            state.lines[idx] = overwriteLine(state.lines[idx]!, lines.shift()!);
            idx += 1;
        }
        state.lines.push(...lines);
        idx += lines.length - 1;
        state.cursor = { ...cursor, line: idx, column: state.lines[idx]!.columns };
    }
    prune(state.lines);
}

function totalColumns(chunks: TextChunk[]): number {
    const lastChunk = chunks[chunks.length - 1];
    if (!lastChunk) return 0;
    const { x: [x, span] } = lastChunk;
    return x + span;
}

/**
 * Removes content before the column index from a line
 * @param line - terminal line that is being cleared
 * @param column - column location of the cursor up to which the line will be cleared
 * @param newIndex - new index property of the updated line
 * @returns updated line with content partially cleared
 */
export function clearLineBefore(line: TerminalLine, column: number, newIndex?: number): TerminalLine {
    const idx = line.chunks.findIndex(({ x: [x, span] }) => column < x + span);
    // remove all chunks if idx < 0
    if (idx < 0) return { index: newIndex ?? line.index, columns: 0, chunks: [] };
    // slice index chunk after cursor column
    const chunks: TextChunk[] = [],
        chunk = sliceChunkAfter(line.chunks[idx]!, column);
    if (chunk) chunks.push(chunk);
    chunks.push(...line.chunks.slice(idx + 1));
    // return updated terminal line
    return { index: newIndex ?? line.index, columns: totalColumns(chunks), chunks };
}

/**
 * Removes content after the column index from a line
 * @param line - terminal line that is being cleared
 * @param column - column location of the cursor after which the line will be cleared
 * @returns updated line with content partially cleared
 */
export function clearLineAfter(line: TerminalLine, column: number): TerminalLine {
    if (column === 0) return { index: line.index, columns: 0, chunks: [] };
    const idx = line.chunks.findIndex(({ x: [x, span] }) => column < x + span);
    if (idx < 0) return line;
    const chunks = line.chunks.slice(0, idx),
        chunk = sliceChunkBefore(line.chunks[idx]!, column);
    if (chunk) chunks.push(chunk);
    // return updated terminal line
    return { index: line.index, columns: totalColumns(chunks), chunks };
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

function parseEscape({ columns, rows }: ParseContext, state: ScreenData, esc: string) {
    const { lines, cursor } = state;
    // move cursor with `ESC[#;#H`
    let m = /^\x1b\[(?:(\d+)?;(\d+)?)?[Hf]$/.exec(esc);
    if (m) {
        const line = Math.min(Number(m[1] ?? '1') - 1, rows - 1),
            column = Math.min(Number(m[2] ?? '1') - 1, columns - 1);
        state.cursor = { ...cursor, line, column };
        return;
    }
    // move cursor with `ESC[#A`, `ESC[#B`, `ESC[#C`, `ESC[#D`, `ESC[#E`, `ESC[#F`, & `ESC[#G`
    m = /^\x1b\[(\d+)?([A-G])$/.exec(esc);
    if (m) {
        const code = m[2]! as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
            delta = Math.max(Number(m[1] ?? '1'), 1);
        switch (code) {
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
                while (col < 0 && lines[idx] && lines[idx]!.index > 0) {
                    idx -= 1;
                    col += columns;
                }
                state.cursor = { ...cursor, column: Math.max(col, 0), line: idx };
                break;
            }
            case 'E':
                // moves cursor to beginning of next line, # lines down
                state.cursor = { ...cursor, line: Math.min(cursor.line + delta, rows - 1), column: 0 };
                break;
            case 'F':
                // moves cursor to beginning of previous line, # lines up
                state.cursor = { ...cursor, line: Math.max(cursor.line - delta, 0), column: 0 };
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
    m = /^\x1b\[([0-2])?([JK])$/.exec(esc);
    if (m) {
        switch (((m[1] ?? '0') + m[2]!) as '0J' | '1J' | '2J' | '0K' | '1K' | '2K') {
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
                lines[cursor.line] = clearLineBefore(lines[cursor.line]!, cursor.column, 0);
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
    // toggle cursor visibility `\x1b[?25l` & `\x1b[?25h`
    m = /^\x1b\[\?25([hl])$/.exec(esc);
    if (m) state.cursor = { ...cursor, hidden: m[1] === 'l' };
    // unsupported escapes fallthrough to here
}

export default function parse(context: ParseContext, state: ScreenData, content: string): ScreenData {
    const re = new RegExp(`(?:${ctrlRegex})+`, 'g');
    for (const [chunk, ctrl] of regexChunks(re, content)) {
        if (ctrl) {
            const escapes = chunk.match(new RegExp(`(?:${ctrlRegex})`, 'g'))!;
            for (const esc of escapes) parseEscape(context, state, esc);
        } else parseContent(context, state, chunk);
    }
    return state;
}