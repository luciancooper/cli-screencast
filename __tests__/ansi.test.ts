import type { AnsiStyle } from '@src/types';
import { resolveTheme } from '@src/theme';
import { color8Bit, toHex } from '@src/color';
import parseAnsi from '@src/ansi';
import * as ansi from './helpers/ansi';

const { palette, theme } = resolveTheme();

const chunk = (str: string, style: Partial<AnsiStyle> = {}) => ({
    chunk: str,
    style: {
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        inverted: false,
        strikeThrough: false,
        ...style,
    },
});

const parse = (content: string) => [...parseAnsi(palette, content)];

describe('parseAnsi', () => {
    test('sgr set display attribute', () => {
        expect(parse(`${ansi.bold('bold')} and ${ansi.underline('underline')}`)).toEqual([
            chunk('bold', { bold: true }),
            chunk(' and '),
            chunk('underline', { underline: true }),
        ]);
    });

    test('sgr set foreground (4 bit)', () => {
        expect(parse(`${ansi.fg(32, 'green')} and ${ansi.fg(96, 'bright cyan')}`)).toEqual([
            chunk('green', { foreground: theme.green }),
            chunk(' and '),
            chunk('bright cyan', { foreground: theme.brightCyan }),
        ]);
    });

    test('sgr set background (4 bit)', () => {
        expect(parse(`background ${ansi.bg(41, 'red')} and ${ansi.bg(102, 'bright green')}`)).toEqual([
            chunk('background '),
            chunk('red', { background: theme.red }),
            chunk(' and '),
            chunk('bright green', { background: theme.brightGreen }),
        ]);
    });

    test('sgr set foreground / background (8 bit)', () => {
        expect(parse(`8 bit ${ansi.fg8Bit(186, 'foreground')} and ${ansi.bg8Bit(64, 'background')}`)).toEqual([
            chunk('8 bit '),
            chunk('foreground', { foreground: color8Bit(186, palette) }),
            chunk(' and '),
            chunk('background', { background: color8Bit(64, palette) }),
        ]);
    });

    test('sgr set foreground / background (24 bit)', () => {
        const fg = ansi.fgRGB([215, 215, 135], 'foreground'),
            bg = ansi.bgRGB([95, 135, 0], 'background');
        expect(parse(`24 bit ${fg} and ${bg}`)).toEqual([
            chunk('24 bit '),
            chunk('foreground', { foreground: toHex([215, 215, 135]) }),
            chunk(' and '),
            chunk('background', { background: toHex([95, 135, 0]) }),
        ]);
    });

    test('malformed set foreground / background sequences', () => {
        // code following 38 / 48 can only be 2 / 5
        expect(parse(`${ansi.sgr(48, 7)}bad escape`)).toEqual([
            chunk('bad escape'),
        ]);
        // 8 bit - color value defaults to 0
        expect(parse(`${ansi.sgr(38, 5)}bad escape${ansi.sgr(39)}`)).toEqual([
            chunk('bad escape', { foreground: color8Bit(0, palette) }),
        ]);
        // 24 bit - default to [0, 0, 0] when color args are missing
        expect(parse(`${ansi.sgr(38, 2)}bad escape${ansi.sgr(39)}`)).toEqual([
            chunk('bad escape', { foreground: toHex([0, 0, 0]) }),
        ]);
        // 8 bit - constrain provided color values
        expect(parse(`${ansi.sgr(38, 5, 300)}invalid 8 bit color${ansi.sgr(39)}`)).toEqual([
            chunk('invalid 8 bit color', { foreground: color8Bit(0xFF, palette) }),
        ]);
        // 24 bit - fill missing r, g, b values
        expect(parse(`${ansi.sgr(48, 2, '', 128, '')}R & G missing${ansi.sgr(49)}`)).toEqual([
            chunk('R & G missing', { background: toHex([0, 128, 0]) }),
        ]);
    });

    test('sgr compound foreground / background escapes (4 bit)', () => {
        expect(parse(`${ansi.sgr(31, 43)}fg red and bg yellow${ansi.sgr(39, 49)}`)).toEqual([
            chunk('fg red and bg yellow', { foreground: theme.red, background: theme.yellow }),
        ]);
    });

    test('sgr reset sequence ([0m)', () => {
        expect(parse(`${ansi.sgr(31)}Red fg + ${ansi.sgr(43)}Yellow bg${ansi.sgr(0)} is reset`)).toEqual([
            chunk('Red fg + ', { foreground: theme.red }),
            chunk('Yellow bg', { foreground: theme.red, background: theme.yellow }),
            chunk(' is reset'),
        ]);
    });

    test('hyperlink escape sequence', () => {
        expect(parse(`${ansi.link('hyperlink', 'https://www.google.com')} sequence`)).toEqual([
            chunk('hyperlink', { link: 'https://www.google.com' }),
            chunk(' sequence'),
        ]);
    });

    test('merge sequential chunks with common styling', () => {
        expect(parse(ansi.bold('text is') + ansi.bold(' still bold'))).toEqual([
            chunk('text is still bold', { bold: true }),
        ]);
    });

    test('handle empty escape sequences', () => {
        expect(parse(ansi.sgr(31) + ansi.sgr(39))).toEqual([]);
    });

    test('ignore unsupported escape sequences', () => {
        expect(parse(`${ansi.sgr(73)}superscript${ansi.sgr(75)}`)).toEqual([
            chunk('superscript'),
        ]);
        expect(parse('there is a hidden \x1b]0;window_title\x07 window title sequence')).toEqual([
            chunk('there is a hidden  window title sequence'),
        ]);
    });
});