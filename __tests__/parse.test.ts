import type { Dimensions, CursorLocation, Title, ScreenData, TerminalLine } from '@src/types';
import { resolveTheme } from '@src/theme';
import { clone } from '@src/utils';
import parse, { ParseContext } from '@src/parse';
import { makeLine } from './helpers/objects';
import * as ansi from './helpers/ansi';

const { theme, palette } = resolveTheme();

type CursorPartial = Partial<CursorLocation>;

const makeContext = (dim: Dimensions): ParseContext => ({ ...dim, tabSize: 8, palette });

interface Parser {
    (...content: string[]): ScreenData
    state: ScreenData
    prev: ScreenData
}

const makeParser = (dim: Dimensions, cursorHidden = false, title: Partial<Title> = {}): Parser => {
    const context = makeContext(dim),
        state = {
            lines: [],
            cursor: { line: 0, column: 0, hidden: cursorHidden },
            title: {
                columns: 0,
                chunks: [],
                text: undefined,
                icon: undefined,
                ...title,
            },
        },
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
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 5, column: 10 });
        // cursor backward + up
        parser(ansi.cursorBackward(5) + ansi.cursorUp(2));
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 3, column: 5 });
        // cursor forward + down
        parser(ansi.cursorForward(10) + ansi.cursorDown(1));
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 4, column: 15 });
        // cursor line up
        parser(ansi.cursorLineUp(2));
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 2, column: 0 });
        // cursor to column
        parser(ansi.cursorColumn(10));
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 2, column: 10 });
        // cursor line down
        parser(ansi.cursorLineDown());
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 3, column: 0 });
        // cursor home
        parser(ansi.cursorHome);
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 0, column: 0 });
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
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(['ab', { fg: theme.green }]) },
        ]);
        parser(ansi.fg(31, 'cdef'));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(['ab', { fg: theme.green }], ['cdef', { fg: theme.red }]) },
        ]);
    });

    test('write lines with full width characters', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        // write line of half width characters
        parser('aaaaaaaaaaaaaaaaaaa');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaaaaaaaaaaa') },
        ]);
        // write line of full width characters
        parser(ansi.bold('ｂｂｂｂｂｂｂｂｂｂ'));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaaaaaaaaaaa') },
            { index: 1, ...makeLine(['ｂｂｂｂｂｂｂｂｂｂ', { bold: true }]) },
        ]);
        // move cursor down and write another line
        parser(ansi.cursorLineDown(2), 'cccccccccc');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaaaaaaaaaaa') },
            { index: 1, ...makeLine(['ｂｂｂｂｂｂｂｂｂｂ', { bold: true }]) },
            { index: 0, ...makeLine() },
            { index: 0, ...makeLine('cccccccccc') },
        ]);
    });

    test('write lines containing tab characters', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aa\tbb\tcc\t\txx\tyy\tzz\t');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aa      bb      cc  ') },
            { index: 1, ...makeLine('xx      yy      zz  ') },
        ]);
    });

    test('clear from cursor to end of screen (0J)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbb\n');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaaaaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbbbbbbb') },
        ]);
        // does nothing
        parser(ansi.eraseDown);
        expect(parser.state).toEqual(parser.prev);
        // move up 2 lines, forward, and erase down
        parser(ansi.cursorUp(2), ansi.cursorForward(), ansi.eraseDown);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('a') },
        ]);
    });

    test('clear from cursor to beginning of screen (1J)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbb');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaaaaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbbbbbbb') },
        ]);
        // erase up from the middle of the second line
        parser(ansi.cursorTo(1, 5), ansi.eraseUp);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine() },
            { index: 0, ...makeLine(5, 'bbbbbbbbbb') },
        ]);
        // move cursor down and erase up to clear all content
        parser(ansi.cursorDown(), ansi.eraseUp);
        expect(parser.state.lines).toHaveLength(0);
    });

    test('clear the entire screen (2J)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbb');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaaaaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbbbbbbb') },
        ]);
        // erase screen
        parser(ansi.eraseScreen);
        expect(parser.state.lines).toHaveLength(0);
    });

    test('clear from cursor to end of line (0K)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxxxxxxx\n');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxxxxxxx') },
        ]);
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 1, column: 0 });
        // does nothing
        parser(ansi.eraseLineEnd);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to end of line
        parser(ansi.cursorUp(), ansi.cursorForward(5), ansi.eraseLineEnd);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxx') },
        ]);
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 0, column: 5 });
    });

    test('clear from cursor to start of line (1K)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxxxxxxx\n', ansi.cursorColumn(10));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxxxxxxx') },
        ]);
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 1, column: 10 });
        // does nothing
        parser(ansi.eraseLineStart);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to start of line
        parser(ansi.cursorUp(), ansi.eraseLineStart);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(10, 'xxxxx') },
        ]);
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 0, column: 10 });
    });

    test('clear the entire line (2K)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxxxxxxx\n');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxxxxxxx') },
        ]);
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 1, column: 0 });
        // does nothing
        parser(ansi.eraseLine);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to start of line
        parser(ansi.cursorUp(), ansi.eraseLine);
        expect(parser.state.lines).toEqual<TerminalLine[]>([]);
        expect(parser.state.cursor).toMatchObject<CursorPartial>({ line: 0, column: 0 });
    });

    test('cursor backwards line wrapping dependent on line wrap continuity', () => {
        const parser = makeParser({ columns: 10, rows: 5 });
        parser('aaaaaaaaaabbbbbbbbbb\n', 'cccccccccc');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('bbbbbbbbbb') },
            { index: 0, ...makeLine('cccccccccc') },
        ]);
        // cursor wraps to first line
        parser(ansi.cursorTo(1, 5), ansi.cursorBackward(10));
        expect(parser.state.cursor).toMatchObject<Partial<CursorLocation>>({ line: 0, column: 5 });
        // break line continuation
        parser(ansi.eraseLineEnd);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbb') },
            { index: 0, ...makeLine('cccccccccc') },
        ]);
        // cursor will not wrap to first line
        parser(ansi.cursorTo(1, 5), ansi.cursorBackward(10));
        expect(parser.state.cursor).toMatchObject<Partial<CursorLocation>>({ line: 1, column: 0 });
    });

    test('set window title and icon', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        expect(parser.state.title).toMatchObject<Partial<Title>>({ icon: undefined, text: undefined });
        // set both title & icon
        parser('\x1b]0;title\x07');
        expect(parser.state.title).toMatchObject<Partial<Title>>({ icon: 'shell', text: 'title' });
        // set only icon
        parser('\x1b]1;node\x07');
        expect(parser.state.title).toMatchObject<Partial<Title>>({ icon: 'node', text: 'title' });
        // set only title
        parser('\x1b]2;new title\x07');
        expect(parser.state.title).toMatchObject<Partial<Title>>({ icon: 'node', text: 'new title' });
        // nullify icon
        parser('\x1b]1;\x07');
        expect(parser.state.title).toMatchObject<Partial<Title>>({ icon: undefined, text: 'new title' });
        // nullify title
        parser('\x1b]2;\x07');
        expect(parser.state.title).toMatchObject<Partial<Title>>({ icon: undefined, text: undefined });
    });
});