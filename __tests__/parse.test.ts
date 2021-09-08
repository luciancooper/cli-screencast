import type { CursorLocation, DeepPartial, Dimensions, ScreenData, TerminalLine } from '@src/types';
import { resolveTheme } from '@src/theme';
import { clone } from '@src/utils';
import parse, { ParseContext } from '@src/parse';
import * as ansi from './helpers/ansi';

const { palette } = resolveTheme();

type ScreenPartial = DeepPartial<ScreenData>;

type LinePartial = DeepPartial<TerminalLine>;

const makeContext = (dim: Dimensions): ParseContext => ({ ...dim, tabSize: 8, palette });

interface Parser {
    (...content: string[]): ScreenData
    state: ScreenData
    prev: ScreenData
}

const makeParser = (dim: Dimensions, cursorHidden = false): Parser => {
    const context = makeContext(dim),
        state = { lines: [], cursor: { line: 0, column: 0, hidden: cursorHidden } },
        parser = Object.assign((...content: string[]) => {
            parser.prev = clone(state);
            return parse(context, state, content.join(''));
        }, { state, prev: state });
    return parser;
};

describe('parse', () => {
    test('show / hide cursor', () => {
        const parser = makeParser({ columns: 40, rows: 10 }, false);
        expect(parser.state.cursor.hidden).toBe(false);
        expect(parser(ansi.hideCursor).cursor.hidden).toBe(true);
        expect(parser(ansi.showCursor).cursor.hidden).toBe(false);
    });

    test('move cursor', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // cursor to
        parser(ansi.cursorTo(5, 10));
        expect(parser.state.cursor).toMatchObject({ line: 5, column: 10 });
        // cursor backward + up
        parser(ansi.cursorBackward(5) + ansi.cursorUp(2));
        expect(parser.state.cursor).toMatchObject({ line: 3, column: 5 });
        // cursor forward + down
        parser(ansi.cursorForward(10) + ansi.cursorDown(1));
        expect(parser.state.cursor).toMatchObject({ line: 4, column: 15 });
        // cursor line up
        parser(ansi.cursorLineUp(2));
        expect(parser.state.cursor).toMatchObject({ line: 2, column: 0 });
        // cursor to column
        parser(ansi.cursorColumn(10));
        expect(parser.state.cursor).toMatchObject({ line: 2, column: 10 });
        // cursor line down
        parser(ansi.cursorLineDown());
        expect(parser.state.cursor).toMatchObject({ line: 3, column: 0 });
        // cursor home
        parser(ansi.cursorHome);
        expect(parser.state.cursor).toMatchObject({ line: 0, column: 0 });
    });

    test('ignore unsupported control escapes', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        parser(ansi.enableAlternateBuffer);
        expect(parser.state).toEqual(parser.prev);
    });

    test('write styled chunks', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        // write line of half width characters
        parser(ansi.fg(32, 'ab'));
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 2, chunks: [{ str: 'ab', x: [0, 2] }] },
        ]);
        parser(ansi.fg(31, 'cdef'));
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 6, chunks: [{ str: 'ab', x: [0, 2] }, { str: 'cdef', x: [2, 4] }] },
        ]);
    });

    test('write lines with full width characters', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        // write line of half width characters
        parser('aaaaaaaaaaaaaaaaaaa');
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 19, chunks: [{ str: 'aaaaaaaaaaaaaaaaaaa', x: [0, 19] }] },
        ]);
        // write line of full width characters
        parser(ansi.bold('ｂｂｂｂｂｂｂｂｂｂ'));
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 19, chunks: [{ str: 'aaaaaaaaaaaaaaaaaaa', x: [0, 19] }] },
            { index: 1, columns: 20, chunks: [{ str: 'ｂｂｂｂｂｂｂｂｂｂ', x: [0, 20] }] },
        ]);
        // move cursor down and write another line
        parser(ansi.cursorLineDown(2), 'cccccccccc');
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 19, chunks: [{ str: 'aaaaaaaaaaaaaaaaaaa', x: [0, 19] }] },
            { index: 1, columns: 20, chunks: [{ str: 'ｂｂｂｂｂｂｂｂｂｂ', x: [0, 20] }] },
            { index: 0, columns: 0, chunks: [] },
            { index: 0, columns: 10, chunks: [{ str: 'cccccccccc', x: [0, 10] }] },
        ]);
    });

    test('write lines containing tab characters', () => {
        const state = parse(
            makeContext({ columns: 20, rows: 10 }),
            { lines: [], cursor: { line: 0, column: 0, hidden: false } },
            'aa\tbb\tcc\t\txx\tyy\tzz\t',
        );
        expect(state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 20, chunks: [{ str: 'aa      bb      cc  ', x: [0, 20] }] },
            { index: 1, columns: 20, chunks: [{ str: 'xx      yy      zz  ', x: [0, 20] }] },
        ]);
    });

    test('clear from cursor to end of screen (0J)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbb\n');
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 15, chunks: [{ str: 'aaaaaaaaaaaaaaa', x: [0, 15] }] },
            { index: 0, columns: 15, chunks: [{ str: 'bbbbbbbbbbbbbbb', x: [0, 15] }] },
        ]);
        // does nothing
        parser(ansi.eraseDown);
        expect(parser.state).toEqual(parser.prev);
        // move up 2 lines, forward, and erase down
        parser(ansi.cursorUp(2), ansi.cursorForward(), ansi.eraseDown);
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 1, chunks: [{ str: 'a', x: [0, 1] }] },
        ]);
    });

    test('clear from cursor to beginning of screen (1J)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbb');
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 15, chunks: [{ str: 'aaaaaaaaaaaaaaa', x: [0, 15] }] },
            { index: 0, columns: 15, chunks: [{ str: 'bbbbbbbbbbbbbbb', x: [0, 15] }] },
        ]);
        // erase up from the middle of the second line
        parser(ansi.cursorTo(1, 5), ansi.eraseUp);
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 0, chunks: [] },
            { index: 0, columns: 15, chunks: [{ str: 'bbbbbbbbbb', x: [5, 10] }] },
        ]);
        // move cursor down and erase up to clear all content
        parser(ansi.cursorDown(), ansi.eraseUp);
        expect(parser.state.lines).toHaveLength(0);
    });

    test('clear the entire screen (2J)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbb');
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 15, chunks: [{ str: 'aaaaaaaaaaaaaaa', x: [0, 15] }] },
            { index: 0, columns: 15, chunks: [{ str: 'bbbbbbbbbbbbbbb', x: [0, 15] }] },
        ]);
        // erase screen
        parser(ansi.eraseScreen);
        expect(parser.state.lines).toHaveLength(0);
    });

    test('clear from cursor to end of line (0K)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxxxxxxx\n');
        expect(parser.state).toMatchObject<ScreenPartial>({
            lines: [{ index: 0, columns: 15, chunks: [{ str: 'xxxxxxxxxxxxxxx', x: [0, 15] }] }],
            cursor: { line: 1, column: 0 },
        });
        // does nothing
        parser(ansi.eraseLineEnd);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to end of line
        parser(ansi.cursorUp(), ansi.cursorForward(5), ansi.eraseLineEnd);
        expect(parser.state).toMatchObject<ScreenPartial>({
            lines: [{ index: 0, columns: 5, chunks: [{ str: 'xxxxx', x: [0, 5] }] }],
            cursor: { line: 0, column: 5 },
        });
    });

    test('clear from cursor to start of line (1K)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxxxxxxx\n', ansi.cursorColumn(10));
        expect(parser.state).toMatchObject<ScreenPartial>({
            lines: [{ index: 0, columns: 15, chunks: [{ str: 'xxxxxxxxxxxxxxx', x: [0, 15] }] }],
            cursor: { line: 1, column: 10 },
        });
        // does nothing
        parser(ansi.eraseLineStart);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to start of line
        parser(ansi.cursorUp(), ansi.eraseLineStart);
        expect(parser.state).toMatchObject<ScreenPartial>({
            lines: [{ index: 0, columns: 15, chunks: [{ str: 'xxxxx', x: [10, 5] }] }],
            cursor: { line: 0, column: 10 },
        });
    });

    test('clear the entire line (2K)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxxxxxxx\n');
        expect(parser.state).toMatchObject<ScreenPartial>({
            lines: [{ index: 0, columns: 15, chunks: [{ str: 'xxxxxxxxxxxxxxx', x: [0, 15] }] }],
            cursor: { line: 1, column: 0 },
        });
        // does nothing
        parser(ansi.eraseLine);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to start of line
        parser(ansi.cursorUp(), ansi.eraseLine);
        expect(parser.state).toMatchObject<ScreenPartial>({ lines: [], cursor: { line: 0, column: 0 } });
    });

    test('cursor backwards line wrapping dependent on line wrap continuity', () => {
        const parser = makeParser({ columns: 10, rows: 5 });
        parser('aaaaaaaaaabbbbbbbbbb\n', 'cccccccccc');
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 10, chunks: [{ str: 'aaaaaaaaaa', x: [0, 10] }] },
            { index: 1, columns: 10, chunks: [{ str: 'bbbbbbbbbb', x: [0, 10] }] },
            { index: 0, columns: 10, chunks: [{ str: 'cccccccccc', x: [0, 10] }] },
        ]);
        // cursor wraps to first line
        parser(ansi.cursorTo(1, 5), ansi.cursorBackward(10));
        expect(parser.state.cursor).toMatchObject<Partial<CursorLocation>>({ line: 0, column: 5 });
        // break line continuation
        parser(ansi.eraseLineEnd);
        expect(parser.state.lines).toMatchObject<LinePartial[]>([
            { index: 0, columns: 5, chunks: [{ str: 'aaaaa', x: [0, 5] }] },
            { index: 0, columns: 10, chunks: [{ str: 'bbbbbbbbbb', x: [0, 10] }] },
            { index: 0, columns: 10, chunks: [{ str: 'cccccccccc', x: [0, 10] }] },
        ]);
        // cursor will not wrap to first line
        parser(ansi.cursorTo(1, 5), ansi.cursorBackward(10));
        expect(parser.state.cursor).toMatchObject<Partial<CursorLocation>>({ line: 1, column: 0 });
    });
});