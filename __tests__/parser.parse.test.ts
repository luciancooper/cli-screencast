import type { Dimensions, CursorLocation, Title, TerminalLine, AnsiStyle } from '@src/types';
import { clone } from '@src/parser/utils';
import { resolveTitle } from '@src/parser/title';
import parse, { type ParseContext, type ParseState } from '@src/parser/parse';
import { makeLine, makeStyle } from './helpers/objects';
import * as ansi from './helpers/ansi';

interface Parser {
    (...content: string[]): ParseState
    state: ParseState
    prev: ParseState
}

const makeParser = (dim: Dimensions, cursorHidden = false): Parser => {
    const context: ParseContext = { ...dim, tabSize: 8 },
        state = {
            lines: [],
            cursor: { line: 0, column: 0 },
            cursorHidden,
            title: null,
            style: { props: 0, fg: 0, bg: 0 },
            savedCursor: { line: 0, column: 0, style: { props: 0, fg: 0, bg: 0 } },
        },
        parser = Object.assign((...content: string[]) => {
            parser.prev = clone(state);
            return parse(context, state, content.join(''));
        }, { state, prev: state });
    return parser;
};

describe('escape sequences', () => {
    test('ignore unsupported escape sequence types', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // ignore dcs escape
        parser('\x1bP!|00010205\x1b\x5c');
        expect(parser.state).toEqual(parser.prev);
        // ignore Fs escape
        parser('\x1bl');
        expect(parser.state).toEqual(parser.prev);
    });

    test('show / hide cursor', () => {
        const parser = makeParser({ columns: 40, rows: 10 }, false);
        expect(parser.state.cursorHidden).toBe(false);
        expect(parser(ansi.hideCursor).cursorHidden).toBe(true);
        expect(parser(ansi.showCursor).cursorHidden).toBe(false);
        expect(parser(ansi.csi('?1047;25l')).cursorHidden).toBe(true);
    });

    test('move cursor', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // cursor to
        parser(ansi.cursorTo(5, 10));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 5, column: 10 });
        // cursor backward + up
        parser(ansi.cursorBackward(5) + ansi.cursorUp(2));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 3, column: 5 });
        // cursor forward + down
        parser(ansi.cursorForward(10) + ansi.cursorDown(1));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 4, column: 15 });
        // cursor line up
        parser(ansi.cursorLineUp(2));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 0 });
        // cursor to column
        parser(ansi.cursorColumn(10));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 10 });
        // cursor line down
        parser(ansi.cursorLineDown());
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 3, column: 0 });
        // cursor home
        parser(ansi.cursorHome);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 0 });
    });

    test('ignore malformed cursor movement escapes', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        expect(parser(ansi.cursorTo(2, 2)).cursor).toEqual<CursorLocation>({ line: 2, column: 2 });
        parser(ansi.csi('2 A')); // shift right code
        expect(parser.state).toEqual(parser.prev);
        parser(ansi.csi('?3G')); // malformed cursor horizontal escape
        expect(parser.state).toEqual(parser.prev);
    });

    test('ignore unsupported mode control escapes', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        parser(ansi.enableAlternateBuffer);
        expect(parser.state).toEqual(parser.prev);
        parser(ansi.csi('3h')); // show control characters
        expect(parser.state).toEqual(parser.prev);
    });
});

describe('osc escape sequences', () => {
    test('set window title and icon', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        expect(parser.state.title).toBeNull();
        // set both title & icon
        parser(ansi.osc('0', 'title'));
        expect(parser.state.title).toEqual<Title>(resolveTitle('title', 'shell')!);
        // set only icon
        parser(ansi.osc('1', 'node'));
        expect(parser.state.title).toEqual<Title>(resolveTitle('title', 'node')!);
        // set only title
        parser(ansi.osc('2', 'new title'));
        expect(parser.state.title).toEqual<Title>(resolveTitle('new title', 'node')!);
        // nullify icon
        parser(ansi.osc('1', ''));
        expect(parser.state.title).toEqual<Title>(resolveTitle('new title')!);
        // nullify title
        parser(ansi.osc('2', ''));
        expect(parser.state.title).toBeNull();
    });

    test('hyperlink escapes', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // write line with opening hyperlink escape
        parser(`text with ${ansi.osc('8', '', 'https://www.google.com')}hyperlink styling`);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('text with ', ['hyperlink styling', { link: 'https://www.google.com' }]) },
        ]);
        expect(parser.state.style.link).toBe('https://www.google.com');
        // write next line and close hyperlink styling
        parser(`\n${ansi.osc('8', '', '')} has closed`);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('text with ', ['hyperlink styling', { link: 'https://www.google.com' }]) },
            { index: 0, ...makeLine(' has closed') },
        ]);
        expect(parser.state.style.link).toBeUndefined();
    });

    test('hyperlink escapes with parameters', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // write opening hyperlink escape with parameters
        parser(ansi.osc('8', 'id=value', 'https://www.example.com/?q=hello+world'));
        expect(parser.state.style.link).toBe('https://www.example.com/?q=hello+world');
        // write text
        parser('hyperlink text');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(['hyperlink text', { link: 'https://www.example.com/?q=hello+world' }]) },
        ]);
        // write closing escape
        parser(ansi.osc('8', 'id=value', ''));
        expect(parser.state.style.link).toBeUndefined();
    });

    test('ignore malformed hyperlink escapes', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // these sequences are not properly deliminated
        parser(`${ansi.osc('8', 'https://www.example.com')}malformed hyperlink${ansi.osc('8', '')} sequence`);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('malformed hyperlink sequence') },
        ]);
    });

    test('ignore unknown osc escapes', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        parser('\x1b]30101\x1b\x5c');
        expect(parser.state).toEqual(parser.prev);
    });
});

describe('save / restore cursor', () => {
    test('supports both DEC and SCO escapes', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // move to (2, 2)
        expect(parser(ansi.cursorTo(2, 2)).cursor).toEqual<CursorLocation>({ line: 2, column: 2 });
        // save cursor (DECSC)
        parser(ansi.DECSC);
        // move to (4, 0)
        expect(parser(ansi.cursorTo(4, 0)).cursor).toEqual<CursorLocation>({ line: 4, column: 0 });
        // restore cursor (DECRC)
        expect(parser(ansi.DECRC).cursor).toEqual<CursorLocation>({ line: 2, column: 2 });
        // move to (6, 30)
        expect(parser(ansi.cursorTo(6, 30)).cursor).toEqual<CursorLocation>({ line: 6, column: 30 });
        // save cursor (SCOSC)
        parser(ansi.SCOSC);
        // move to (4, 20)
        expect(parser(ansi.cursorTo(4, 20)).cursor).toEqual<CursorLocation>({ line: 4, column: 20 });
        // restore cursor (SCORC)
        expect(parser(ansi.SCORC).cursor).toEqual<CursorLocation>({ line: 6, column: 30 });
    });

    test('saves & restores sgr attribute state', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // move to (2, 2) & set fg red
        parser(ansi.cursorTo(2, 2) + ansi.sgr(31));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 2 });
        expect(parser.state.style).toEqual<AnsiStyle>(makeStyle({ fg: 1 }));
        // save cursor + reset fg style & move cursor to (4, 0)
        parser(ansi.DECSC + ansi.sgr(39) + ansi.cursorTo(4, 0));
        expect(parser.state.style).toEqual<AnsiStyle>(makeStyle());
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 4, column: 0 });
        // restore cursor
        parser(ansi.DECRC);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 2 });
        expect(parser.state.style).toEqual<AnsiStyle>(makeStyle({ fg: 1 }));
    });

    test('does not save or restore hyperlink state', () => {
        const parser = makeParser({ columns: 40, rows: 10 });
        // hyperlink & set fg cyan
        parser(ansi.osc('8', '', 'https://www.google.com') + ansi.sgr(36));
        expect(parser.state.style).toEqual<AnsiStyle>(makeStyle({ fg: 6, link: 'https://www.google.com' }));
        // save cursor
        parser(ansi.DECSC);
        // reset fg & hyperlink + set fg yellow
        parser(ansi.sgr(39) + ansi.osc('8', '', '') + ansi.sgr(43));
        expect(parser.state.style).toEqual<AnsiStyle>(makeStyle({ bg: 3 }));
        // restore cursor, hyperlink should not be restored
        parser(ansi.DECRC);
        expect(parser.state.style).toEqual<AnsiStyle>(makeStyle({ fg: 6 }));
        // reset fg & set new hyperlink
        parser(ansi.sgr(39) + ansi.osc('8', '', 'https://example.com'));
        expect(parser.state.style).toEqual<AnsiStyle>(makeStyle({ link: 'https://example.com' }));
        // restore cursor, hyperlink should not be affected
        parser(ansi.DECRC);
        expect(parser.state.style).toEqual<AnsiStyle>(makeStyle({ fg: 6, link: 'https://example.com' }));
    });
});

describe('writing lines', () => {
    test('write sgr styled chunks', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        // foreground green styled chunk
        parser(ansi.fg(32, 'ab'));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(['ab', { fg: 2 }]) },
        ]);
        // foreground red styled chunk
        parser(ansi.fg(31, 'cdef'));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(['ab', { fg: 2 }], ['cdef', { fg: 1 }]) },
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

    test('maintains line wrap continuity', () => {
        const parser = makeParser({ columns: 10, rows: 10 });
        // write wrapped line
        parser('aaaaaaaaaaaaaaa');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaa') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 1, column: 5 });
        // add to the last line
        parser('bbbbbbbbbbbbbbbbbbbb');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaabbbbb') },
            { index: 2, ...makeLine('bbbbbbbbbb') },
            { index: 3, ...makeLine('bbbbb') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 3, column: 5 });
        // end line
        parser('\n');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaabbbbb') },
            { index: 2, ...makeLine('bbbbbbbbbb') },
            { index: 3, ...makeLine('bbbbb') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 4, column: 0 });
    });

    test('truncate lines to the window row height', () => {
        const parser = makeParser({ columns: 10, rows: 5 });
        parser('aaaaa\n', 'bbbbb\n', 'ccccc\n', 'ddddd\n');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaa') },
            { index: 0, ...makeLine('bbbbb') },
            { index: 0, ...makeLine('ccccc') },
            { index: 0, ...makeLine('ddddd') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 4, column: 0 });
        // add 3 more lines, so that the first two will be truncated
        parser('eeeee\n', 'fffff\n', 'ggggg');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('ccccc') },
            { index: 0, ...makeLine('ddddd') },
            { index: 0, ...makeLine('eeeee') },
            { index: 0, ...makeLine('fffff') },
            { index: 0, ...makeLine('ggggg') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 4, column: 5 });
    });

    test('update line wrap continuity when truncating lines to the window row height', () => {
        const parser = makeParser({ columns: 10, rows: 5 });
        parser('aaaaaaaaaaaaaaaaaaaaaaaaa\n', 'bbbbbbbb\n');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaaaaaaa') },
            { index: 2, ...makeLine('aaaaa') },
            { index: 0, ...makeLine('bbbbbbbb') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 4, column: 0 });
        // add another line so the first one will be truncated
        parser('ccccccccccccccc');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaa') },
            { index: 0, ...makeLine('bbbbbbbb') },
            { index: 0, ...makeLine('cccccccccc') },
            { index: 1, ...makeLine('ccccc') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 4, column: 5 });
        // add a newline to truncate one more line
        parser('\n');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaa') },
            { index: 0, ...makeLine('bbbbbbbb') },
            { index: 0, ...makeLine('cccccccccc') },
            { index: 1, ...makeLine('ccccc') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 4, column: 0 });
    });
});

describe('overwriting lines', () => {
    test('partially overwrite lines with cursor escapes', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxx');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxx') },
        ]);
        // overwrite beginning of the first line with a shorter line
        parser(`${ansi.cursorColumn(0)}yyy`);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('yyyxxxxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 3 });
    });

    test('partially overwrite lines with styled text using cursor escapes', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaaaa\nbbbbbbbbbb\ncccccccccc');
        parser(ansi.cursorColumn(2) + ansi.cursorUp(2));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbb') },
            { index: 0, ...makeLine('cccccccccc') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 2 });
        // overwrite part of the first line, and partially over the second two lines with styled text
        parser(ansi.sgr(3, 32));
        parser('xxxxx');
        parser(ansi.cursorColumn(5) + ansi.cursorDown(1));
        parser('yyy\nzzzzz');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aa', ['xxxxx', { italic: true, fg: 2 }], 'aaa') },
            { index: 0, ...makeLine('bbbbb', ['yyy', { italic: true, fg: 2 }], 'bb') },
            { index: 0, ...makeLine(['zzzzz', { italic: true, fg: 2 }], 'ccccc') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 5 });
    });

    test('partially overwrite lines with carriage returns', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaa\rbbbb');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('bbbbaaaa') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 4 });
        // add a new line from the middle of the first line
        parser('\r\ncccc');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('bbbbaaaa') },
            { index: 0, ...makeLine('cccc') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 1, column: 4 });
    });

    test('partially overwrite styled chunks with carriage returns', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaa\r', ansi.fg(32, 'bbbb'));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(['bbbb', { fg: 2 }], 'aaaa') },
        ]);
        // add a new line from the middle of the first line
        parser(ansi.fg(31, '\r\ncccc'));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(['bbbb', { fg: 2 }], 'aaaa') },
            { index: 0, ...makeLine(['cccc', { fg: 1 }]) },
        ]);
    });

    test('partially overwrite lines with backspace escapes', () => {
        const parser = makeParser({ columns: 10, rows: 10 });
        parser('xxxxxxxxx');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxx') },
        ]);
        // overwrite with backspace escape
        parser('\byyyy\bzzz');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxyy') },
            { index: 1, ...makeLine('yzzz') },
        ]);
    });

    test('overwrite line wrap continuity breaks between lines', () => {
        const parser = makeParser({ columns: 10, rows: 10 });
        parser('aaaaaaaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaaaaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbb') },
            { index: 1, ...makeLine('bbbbbbbbbb') },
            { index: 2, ...makeLine('bbbbbbbbbb') },
        ]);
        // overwrite the continuity break between lines, linking them together
        parser(ansi.cursorTo(1, 5), 'xxxxxxxxxxxxxxx');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaaxxxxx') },
            { index: 2, ...makeLine('xxxxxxxxxx') },
            { index: 3, ...makeLine('bbbbbbbbbb') },
            { index: 4, ...makeLine('bbbbbbbbbb') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 10 });
    });

    test('overwrite lines within line wrap continuity segments', () => {
        const parser = makeParser({ columns: 10, rows: 10 });
        parser('aaaaaaaaaaaaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbb');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaaaaaaa') },
            { index: 2, ...makeLine('aaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbb') },
            { index: 1, ...makeLine('bbbbb') },
        ]);
        // overwrite a portion of the first line without breaking line wrap continuity
        parser(ansi.cursorTo(1, 5), 'xxxxxxxxxxxxxxx');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaaxxxxx') },
            { index: 2, ...makeLine('xxxxxxxxxx') },
            { index: 0, ...makeLine('bbbbbbbbbb') },
            { index: 1, ...makeLine('bbbbb') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 10 });
        // extend the second line while preserving line wrap continuity
        parser(ansi.cursorTo(4, 3), 'yyyyyyyyyy');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaa') },
            { index: 1, ...makeLine('aaaaaxxxxx') },
            { index: 2, ...makeLine('xxxxxxxxxx') },
            { index: 0, ...makeLine('bbbbbbbbbb') },
            { index: 1, ...makeLine('bbbyyyyyyy') },
            { index: 2, ...makeLine('yyy') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 5, column: 3 });
    });
});

describe('form feed & vertical tab escapes', () => {
    test('moves cursor down one row on form feed & vertical tab escapes', () => {
        const parser = makeParser({ columns: 10, rows: 10 });
        parser('xxxxxxxxxxxxxxx');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxx') },
            { index: 1, ...makeLine('xxxxx') },
        ]);
        // write form feed to move down to next line
        parser('\f', 'yyyyyyyyyy');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxx') },
            { index: 1, ...makeLine('xxxxx') },
            { index: 0, ...makeLine(5, 'yyyyy') },
            { index: 1, ...makeLine('yyyyy') },
        ]);
        // move backward to the end of the third line and write vertical tab down
        parser(ansi.cursorBackward(7), '\v', 'zzzzzzzzzz');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxx') },
            { index: 1, ...makeLine('xxxxx') },
            { index: 0, ...makeLine(5, 'yyyyy') },
            { index: 1, ...makeLine('yyyyy', 3, 'zz') },
            { index: 2, ...makeLine('zzzzzzzz') },
        ]);
    });

    test('lines will scroll on form feed or vertical tab escape if buffer is full', () => {
        const parser = makeParser({ columns: 10, rows: 4 });
        parser('xxxxxxxxxxxxxxxxxxxxxxxxx');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxx') },
            { index: 1, ...makeLine('xxxxxxxxxx') },
            { index: 2, ...makeLine('xxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 5 });
        // form feed move down to the last row
        parser('\f');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxx') },
            { index: 1, ...makeLine('xxxxxxxxxx') },
            { index: 2, ...makeLine('xxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 3, column: 5 });
        // vertical tab to ellicit scroll
        parser('\v');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxx') },
            { index: 1, ...makeLine('xxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 3, column: 5 });
        // form feed to ellicit scroll
        parser('\f');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 3, column: 5 });
        // vertical tab to ellicit scroll
        parser('\v');
        expect(parser.state.lines).toEqual<TerminalLine[]>([]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 3, column: 5 });
    });
});

describe('erase escape sequences', () => {
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
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 1, column: 0 });
        // does nothing
        parser(ansi.eraseLineEnd);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to end of line
        parser(ansi.cursorUp(), ansi.cursorForward(5), ansi.eraseLineEnd);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 5 });
    });

    test('clear from cursor to start of line (1K)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxxxxxxx\n', ansi.cursorColumn(10));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxxxxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 1, column: 10 });
        // does nothing
        parser(ansi.eraseLineStart);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to start of line
        parser(ansi.cursorUp(), ansi.eraseLineStart);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine(10, 'xxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 10 });
    });

    test('clear the entire line (2K)', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('xxxxxxxxxxxxxxx\n');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxxxxxxx') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 1, column: 0 });
        // does nothing
        parser(ansi.eraseLine);
        expect(parser.state).toEqual(parser.prev);
        // move up and erase to start of line
        parser(ansi.cursorUp(), ansi.eraseLine);
        expect(parser.state.lines).toEqual<TerminalLine[]>([]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 0 });
    });

    test('malformed erase sequences', () => {
        const parser = makeParser({ columns: 20, rows: 10 });
        parser('aaaaaaaaaaaaaaa\n', 'bbbbbbbbbbbbbbb', ansi.cursorTo(0, 10));
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaaaaaaaaaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbbbbbbb') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 10 });
        // ignore invalid argument
        parser(ansi.csi('3J'));
        expect(parser.state).toEqual(parser.prev);
        // malformed escape ignored
        parser(ansi.csi('+K'));
        expect(parser.state).toEqual(parser.prev);
    });
});

describe('cursor line wrapping', () => {
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
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 5 });
        // break line continuation
        parser(ansi.eraseLineEnd);
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('aaaaa') },
            { index: 0, ...makeLine('bbbbbbbbbb') },
            { index: 0, ...makeLine('cccccccccc') },
        ]);
        // cursor will not wrap to first line
        parser(ansi.cursorTo(1, 5), ansi.cursorBackward(10));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 1, column: 0 });
    });

    test('cursor backwards line wrapping with backspace escapes', () => {
        const parser = makeParser({ columns: 10, rows: 5 });
        parser('xxxxxxxxxxyyyyy\n', 'zzzzzz');
        expect(parser.state.lines).toEqual<TerminalLine[]>([
            { index: 0, ...makeLine('xxxxxxxxxx') },
            { index: 1, ...makeLine('yyyyy') },
            { index: 0, ...makeLine('zzzzzz') },
        ]);
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 6 });
        // move cursor backward to beginning of the third line
        parser('\b'.repeat(10));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 2, column: 0 });
        // move cursor to middle of the second line
        parser(ansi.cursorTo(1, 5));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 1, column: 5 });
        // move cursor backward to line 0 col 0 position
        parser('\b'.repeat(20));
        expect(parser.state.cursor).toEqual<CursorLocation>({ line: 0, column: 0 });
    });
});