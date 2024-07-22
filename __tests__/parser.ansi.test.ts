import { color8Bit } from '@src/color';
import parseAnsi, { type AnsiChunk } from '@src/parser/ansi';
import * as ansi from './helpers/ansi';
import { makeStyle, StylePartial } from './helpers/objects';

const chunk = (str: string, style: StylePartial = {}): AnsiChunk => ({
    chunk: str,
    style: makeStyle(style),
});

const parse = (content: string) => [...parseAnsi(content)];

describe('parseAnsi', () => {
    test('sgr set display attribute', () => {
        expect(parse(`${ansi.bold('bold')} and ${ansi.underline('underline')}`)).toEqual<AnsiChunk[]>([
            chunk('bold', { bold: true }),
            chunk(' and '),
            chunk('underline', { underline: true }),
        ]);
    });

    test('sgr set foreground (4 bit)', () => {
        expect(parse(`${ansi.fg(32, 'green')} and ${ansi.fg(96, 'bright cyan')}`)).toEqual<AnsiChunk[]>([
            chunk('green', { fg: 2 }),
            chunk(' and '),
            chunk('bright cyan', { fg: 14 }),
        ]);
    });

    test('sgr set background (4 bit)', () => {
        expect(parse(`background ${ansi.bg(41, 'red')} and ${ansi.bg(102, 'bright green')}`)).toEqual<AnsiChunk[]>([
            chunk('background '),
            chunk('red', { bg: 1 }),
            chunk(' and '),
            chunk('bright green', { bg: 10 }),
        ]);
    });

    test('sgr set foreground / background (8 bit)', () => {
        expect(
            parse(`8 bit ${ansi.fg8Bit(186, 'foreground')} and ${ansi.bg8Bit(64, 'background')}`),
        ).toEqual<AnsiChunk[]>([
            chunk('8 bit '),
            chunk('foreground', { fg: color8Bit(186) }),
            chunk(' and '),
            chunk('background', { bg: color8Bit(64) }),
        ]);
    });

    test('sgr set foreground / background (24 bit)', () => {
        const fg = ansi.fgRGB([215, 215, 135], 'foreground'),
            bg = ansi.bgRGB([95, 135, 0], 'background');
        expect(parse(`24 bit ${fg} and ${bg}`)).toEqual<AnsiChunk[]>([
            chunk('24 bit '),
            chunk('foreground', { fg: [215, 215, 135] }),
            chunk(' and '),
            chunk('background', { bg: [95, 135, 0] }),
        ]);
    });

    test('sgr compound foreground / background escapes (4 bit)', () => {
        expect(parse(`${ansi.sgr(31, 43)}fg red and bg yellow${ansi.sgr(39, 49)}`)).toEqual<AnsiChunk[]>([
            chunk('fg red and bg yellow', { fg: 1, bg: 3 }),
        ]);
    });

    test('sgr ESC[0m reset escapes', () => {
        expect(parse(`${ansi.sgr(31)}Red fg + ${ansi.sgr(43)}Yellow bg${ansi.sgr(0)} is reset`)).toEqual<AnsiChunk[]>([
            chunk('Red fg + ', { fg: 1 }),
            chunk('Yellow bg', { fg: 1, bg: 3 }),
            chunk(' is reset'),
        ]);
    });

    test('sgr ESC[m implied reset escapes', () => {
        expect(
            parse(`${ansi.sgr(31)}Red fg + ${ansi.sgr('', 43)}Yellow bg${ansi.sgr('')} is reset`),
        ).toEqual<AnsiChunk[]>([
            chunk('Red fg + ', { fg: 1 }),
            chunk('Yellow bg', { bg: 3 }),
            chunk(' is reset'),
        ]);
    });

    test('sgr compound sequence with reset', () => {
        expect(parse(`${ansi.sgr(0, 31)}Red fg${ansi.sgr(0)}`)).toEqual<AnsiChunk[]>([
            chunk('Red fg', { fg: 1 }),
        ]);
    });

    test('hyperlink escape sequence', () => {
        expect(parse(`${ansi.link('hyperlink', 'https://www.google.com')} sequence`)).toEqual<AnsiChunk[]>([
            chunk('hyperlink', { link: 'https://www.google.com' }),
            chunk(' sequence'),
        ]);
    });

    test('merge sequential chunks with common styling', () => {
        expect(parse(ansi.bold('text is') + ansi.bold(' still bold'))).toEqual<AnsiChunk[]>([
            chunk('text is still bold', { bold: true }),
        ]);
    });

    describe('unusual or malformed foreground / background sequences', () => {
        test('non 2 or 5 following a 38 or 48 sgr code', () => {
            // code following 38 / 48 can only be 2 / 5
            expect(parse(`${ansi.sgr(48, 7)}bad escape`)).toEqual<AnsiChunk[]>([
                chunk('bad escape'),
            ]);
        });

        test('sgr code following a malformed 38 or 48 sgr code', () => {
            // code following 38 / 48 can only be 2 / 5
            expect(parse(`${ansi.sgr(48, 7, 3)}italic${ansi.sgr(23)}`)).toEqual<AnsiChunk[]>([
                chunk('italic', { italic: true }),
            ]);
        });

        test('ommitted argument following a 38 or 48 sgr code', () => {
            // ommited argument after 38 or 48 should not be treated as a reset
            expect(parse(`${ansi.sgr(33)}yellow${ansi.sgr(38, '')}+yellow${ansi.sgr(39)}`)).toEqual<AnsiChunk[]>([
                chunk('yellow+yellow', { fg: 3 }),
            ]);
        });

        test('8 bit color with no arguments defaults to 0', () => {
            // 8 bit - color value defaults to 0
            expect(parse(`${ansi.sgr(38, 5)}bad escape${ansi.sgr(39)}`)).toEqual<AnsiChunk[]>([
                chunk('bad escape', { fg: color8Bit(0) }),
            ]);
        });

        test('24 bit color missing arguments default to 0', () => {
            // 24 bit - default to 0 when color args are missing
            expect(parse(`${ansi.sgr(38, 2, 255)}bad escape${ansi.sgr(39)}`)).toEqual<AnsiChunk[]>([
                chunk('bad escape', { fg: [255, 0, 0] }),
            ]);
        });

        test('8 bit color with out of bounds color arguments', () => {
            // 8 bit - constrain provided color values
            expect(parse(`${ansi.sgr(38, 5, 300)}invalid 8 bit color${ansi.sgr(39)}`)).toEqual<AnsiChunk[]>([
                chunk('invalid 8 bit color', { fg: color8Bit(0xFF) }),
            ]);
        });

        test('24 bit color with omitted parameters', () => {
            // 24 bit - fill missing r, g, b values
            expect(parse(`${ansi.sgr(48, 2, '', 128, '')}R & G missing${ansi.sgr(49)}`)).toEqual<AnsiChunk[]>([
                chunk('R & G missing', { bg: [0, 128, 0] }),
            ]);
        });

        test('compound 24 bit color with omitted parameters', () => {
            // 24 bit - fill missing r, g, b values
            expect(parse(`${ansi.sgr(48, 2, 128, '', '', 38, 2, '', '', 150)}omitted args${ansi.sgr(49, 39)}`))
                .toEqual<AnsiChunk[]>([chunk('omitted args', { bg: [128, 0, 0], fg: [0, 0, 150] })]);
        });
    });

    describe('empty escape sequences', () => {
        test('scrub adjacent opening & closing sequences', () => {
            expect(parse(ansi.sgr(31) + ansi.sgr(39))).toEqual<AnsiChunk[]>([]);
        });

        test('scrub compound opening & closing sequences', () => {
            expect(parse(ansi.sgr(31, 39))).toEqual<AnsiChunk[]>([]);
        });

        test('scrub compound opening & implied reset sequences', () => {
            expect(parse(`${ansi.sgr(31, '')}unstyled`)).toEqual<AnsiChunk[]>([chunk('unstyled')]);
        });
    });

    describe('unsupported escape sequences', () => {
        test('ignore unsupported sgr codes', () => {
            expect(parse(`${ansi.sgr(73)}superscript${ansi.sgr(75)}`)).toEqual<AnsiChunk[]>([
                chunk('superscript'),
            ]);
        });

        test('scrub non sgr/hyperlink control codes', () => {
            expect(parse('there is a hidden \x1b]0;window_title\x07 window title sequence')).toEqual<AnsiChunk[]>([
                chunk('there is a hidden  window title sequence'),
            ]);
        });
    });
});