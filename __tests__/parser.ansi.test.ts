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

    test('merge sequential chunks with common styling', () => {
        expect(parse(ansi.bold('text is') + ansi.bold(' still bold'))).toEqual<AnsiChunk[]>([
            chunk('text is still bold', { bold: true }),
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

    test('sgr compound foreground / background escapes (4 bit)', () => {
        expect(parse(`${ansi.sgr(31, 43)}fg red and bg yellow${ansi.sgr(39, 49)}`)).toEqual<AnsiChunk[]>([
            chunk('fg red and bg yellow', { fg: 1, bg: 3 }),
        ]);
    });

    test('sgr underline escapes with subparams', () => {
        expect(parse(`${ansi.sgr('4:1')}underlined text${ansi.sgr('4:0')} is reset`)).toEqual<AnsiChunk[]>([
            chunk('underlined text', { underline: true }),
            chunk(' is reset'),
        ]);
    });

    describe('sgr reset escapes', () => {
        test('sgr ESC[0m reset escapes', () => {
            expect(
                parse(`${ansi.sgr(31)}Red fg + ${ansi.sgr(43)}Yellow bg${ansi.sgr(0)} is reset`),
            ).toEqual<AnsiChunk[]>([
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

        test('sgr ESC[:m reset sequences with only colons', () => {
            expect(
                parse(`${ansi.sgr(31)}Red fg${ansi.sgr(':')} + ${ansi.sgr(43)}Yellow bg${ansi.sgr('::')} is reset`),
            ).toEqual<AnsiChunk[]>([
                chunk('Red fg', { fg: 1 }),
                chunk(' + '),
                chunk('Yellow bg', { bg: 3 }),
                chunk(' is reset'),
            ]);
        });

        test('sgr compound sequence with reset', () => {
            expect(parse(`${ansi.sgr(0, 31)}Red fg${ansi.sgr(0)}`)).toEqual<AnsiChunk[]>([
                chunk('Red fg', { fg: 1 }),
            ]);
        });
    });

    describe('osc hyperlink escapes', () => {
        test('hyperlink escape sequence', () => {
            const [open, close] = [ansi.osc('8', '', 'https://www.google.com'), ansi.osc('8', '', '')];
            expect(parse(`${open}hyperlink${close} sequence`)).toEqual<AnsiChunk[]>([
                chunk('hyperlink', { link: 'https://www.google.com' }),
                chunk(' sequence'),
            ]);
        });

        test('hyperlink escape sequence with parameters', () => {
            const [open, close] = [
                ansi.osc('8', 'id=value', 'https://www.example.com/?q=hello+world'),
                ansi.osc('8', 'id=value', ''),
            ];
            expect(parse(`${open}hyperlink${close} sequence`)).toEqual<AnsiChunk[]>([
                chunk('hyperlink', { link: 'https://www.example.com/?q=hello+world' }),
                chunk(' sequence'),
            ]);
        });

        test('ignore malformed hyperlink escape sequences', () => {
            // these sequences are not properly deliminated
            const [open, close] = [ansi.osc('8', 'https://www.example.com'), ansi.osc('8', '')];
            expect(parse(`${open}malformed hyperlink${close} sequence`)).toEqual<AnsiChunk[]>([
                chunk('malformed hyperlink sequence'),
            ]);
        });
    });

    describe('sgr indexed color sequences (8 bit)', () => {
        test('semicolon (;) delimited subparameters', () => {
            expect(parse(`${ansi.sgr('38;5;93', '48;5;150')}styled text${ansi.sgr(39, 49)}`)).toEqual<AnsiChunk[]>([
                chunk('styled text', { fg: color8Bit(93), bg: color8Bit(150) }),
            ]);
        });

        test('colon (:) delimited subparameters', () => {
            expect(parse(`${ansi.sgr('38:5:93', '48:5:150')}styled text${ansi.sgr(39, 49)}`)).toEqual<AnsiChunk[]>([
                chunk('styled text', { fg: color8Bit(93), bg: color8Bit(150) }),
            ]);
        });

        test('mixed colon (:) & semicolon (;) delimited subparameters', () => {
            expect(parse(`${ansi.sgr('38;5:93', '48;5:150')}styled text${ansi.sgr(39, 49)}`)).toEqual<AnsiChunk[]>([
                chunk('styled text', { fg: color8Bit(93), bg: color8Bit(150) }),
            ]);
        });

        test('implied index arguments', () => {
            expect(
                parse(`${ansi.sgr('38;5;', '48:5:')}fg+bg${ansi.sgr(39, 49)} & ${ansi.fg('38;5:', 'fg')}`),
            ).toEqual<AnsiChunk[]>([
                chunk('fg+bg', { fg: color8Bit(0), bg: color8Bit(0) }),
                chunk(' & '),
                chunk('fg', { fg: color8Bit(0) }),
            ]);
        });

        test('missing index arguments', () => {
            expect(parse(`${ansi.fg('38;5', 'fg')} & ${ansi.bg('48:5', 'bg')}`)).toEqual<AnsiChunk[]>([
                chunk('fg', { fg: color8Bit(0) }),
                chunk(' & '),
                chunk('bg', { bg: color8Bit(0) }),
            ]);
        });

        test('out of bounds index arguments', () => {
            // constrain provided color index values
            expect(parse(`${ansi.fg('38;5;300', 'fg')} & ${ansi.bg('48:5:256', 'bg')}`)).toEqual<AnsiChunk[]>([
                chunk('fg', { fg: color8Bit(255) }),
                chunk(' & '),
                chunk('bg', { bg: color8Bit(255) }),
            ]);
        });
    });

    describe('sgr rgb color sequences (24 bit)', () => {
        test('semicolon (;) delimited subparameters', () => {
            expect(
                parse(`${ansi.fg('38;2;168;52;235', 'fg')} & ${ansi.bg('48;2;192;230;55', 'bg')}`),
            ).toEqual<AnsiChunk[]>([
                chunk('fg', { fg: [168, 52, 235] }),
                chunk(' & '),
                chunk('bg', { bg: [192, 230, 55] }),
            ]);
        });

        test('colon (:) delimited subparameters', () => {
            expect(
                parse(`${ansi.fg('38:2:168:52:235', 'fg')} & ${ansi.bg('48:2:192:230:55', 'bg')}`),
            ).toEqual<AnsiChunk[]>([
                chunk('fg', { fg: [168, 52, 235] }),
                chunk(' & '),
                chunk('bg', { bg: [192, 230, 55] }),
            ]);
        });

        test('mixed colon (:) & semicolon (;) delimited subparameters', () => {
            expect(
                parse(`${ansi.fg('38;2:168:52:235', 'fg')} & ${ansi.bg('48;2;192;230:55', 'bg')}`),
            ).toEqual<AnsiChunk[]>([
                chunk('fg', { fg: [168, 52, 235] }),
                chunk(' & '),
                chunk('bg', { bg: [192, 230, 55] }),
            ]);
        });

        test('implied rgb arguments', () => {
            expect(parse(
                `${ansi.sgr('38;2;;52;', '48;2;:230:')}fg+bg${ansi.sgr(0)}`
                + ` & ${ansi.sgr('38:2::52:235', '48:2:192::')}fg+bg${ansi.sgr(0)}`,
            )).toEqual<AnsiChunk[]>([
                chunk('fg+bg', { fg: [0, 52, 0], bg: [0, 230, 0] }),
                chunk(' & '),
                chunk('fg+bg', { fg: [0, 52, 235], bg: [192, 0, 0] }),
            ]);
        });

        test('missing rgb arguments', () => {
            expect(parse(
                `${ansi.sgr('38:2', '48;2')}fg+bg${ansi.sgr(0)}`
                + ` & ${ansi.sgr('38;2:168', '48;2;192;230')}fg+bg${ansi.sgr(0)}`,
            )).toEqual<AnsiChunk[]>([
                chunk('fg+bg', { fg: [0, 0, 0], bg: [0, 0, 0] }),
                chunk(' & '),
                chunk('fg+bg', { fg: [168, 0, 0], bg: [192, 230, 0] }),
            ]);
        });

        test('out of bounds rgb arguments', () => {
            // constrain provided rgb values
            expect(
                parse(`${ansi.fg('38;2;300;256;200', 'fg')} & ${ansi.bg('48:2:192:120394:55', 'bg')}`),
            ).toEqual<AnsiChunk[]>([
                chunk('fg', { fg: [255, 255, 200] }),
                chunk(' & '),
                chunk('bg', { bg: [192, 255, 55] }),
            ]);
        });

        describe('sequences with omitted color space id parameter', () => {
            test('colon (:) delimited subparameters', () => {
                expect(
                    parse(`${ansi.sgr('38:2::168:52:235', '48:2::192:230:55')}styled text${ansi.sgr(39, 49)}`),
                ).toEqual<AnsiChunk[]>([
                    chunk('styled text', { fg: [168, 52, 235], bg: [192, 230, 55] }),
                ]);
            });

            test('mixed colon (:) & semicolon (;) delimited subparameters', () => {
                expect(
                    parse(`${ansi.sgr('38;2::168:52:235', '48;2;:192:230:55')}styled text${ansi.sgr(39, 49)}`),
                ).toEqual<AnsiChunk[]>([
                    chunk('styled text', { fg: [168, 52, 235], bg: [192, 230, 55] }),
                ]);
            });

            test('implied rgb arguments', () => {
                expect(
                    parse(`${ansi.sgr('38:2:::52:', '48;2::192::55')}styled text${ansi.sgr(39, 49)}`),
                ).toEqual<AnsiChunk[]>([
                    chunk('styled text', { fg: [0, 52, 0], bg: [192, 0, 55] }),
                ]);
            });
        });
    });

    describe('sgr unusual or malformed extended color sequences', () => {
        test('ignores unknown color modes', () => {
            // only supported color modes are 2 (24 bit) & 5 (8 bit)
            expect(parse(`${ansi.sgr(38, 7)}${ansi.sgr('48:6')}unknown color modes`)).toEqual<AnsiChunk[]>([
                chunk('unknown color modes'),
            ]);
        });

        test('does not overconsume parameters following unknown color modes', () => {
            // code following 38 / 48 can only be 2 / 5
            expect(parse(`${ansi.sgr(48, 7, 3)}italic${ansi.sgr(23)}`)).toEqual<AnsiChunk[]>([
                chunk('italic', { italic: true }),
            ]);
        });

        test('ignores sequences with omitted color modes', () => {
            // ommited argument after 38 or 48 should not be treated as a reset
            expect(
                parse(`${ansi.sgr(33)}yellow${ansi.sgr('38;')}+${ansi.sgr(48)}yellow${ansi.sgr(39)}`),
            ).toEqual<AnsiChunk[]>([
                chunk('yellow+yellow', { fg: 3 }),
            ]);
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