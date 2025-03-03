import { applySgrEscape } from '@src/parser/sgr';
import { makeStyle } from './helpers/objects';
import * as ansi from './helpers/ansi';

describe('applySgrEscape', () => {
    test('accepts full escapes or sgr argument strings', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr(3));
        applySgrEscape(style, '7');
        expect(style).toEqual(makeStyle({ italic: true, inverted: true }));
    });

    test('ignores non sgr escapes', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.cursorHome);
        expect(style).toEqual(makeStyle());
    });

    test('bold display attribute', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr(1)); // bold
        expect(style).toEqual(makeStyle({ bold: true }));
        applySgrEscape(style, ansi.sgr(22)); // no bold
        expect(style).toEqual(makeStyle());
    });

    test('underline display attribute', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr(4)); // underline
        expect(style).toEqual(makeStyle({ underline: true }));
        applySgrEscape(style, ansi.sgr(24)); // no underline
        expect(style).toEqual(makeStyle());
    });

    test('set foreground (4 bit)', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr(32)); // fg green
        expect(style).toEqual(makeStyle({ fg: 2 }));
        applySgrEscape(style, ansi.sgr(96)); // fg bright cyan
        expect(style).toEqual(makeStyle({ fg: 14 }));
        applySgrEscape(style, ansi.sgr(39)); // reset fg
        expect(style).toEqual(makeStyle());
    });

    test('set background (4 bit)', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr(41)); // bg red
        expect(style).toEqual(makeStyle({ bg: 1 }));
        applySgrEscape(style, ansi.sgr(102)); // bg bright green
        expect(style).toEqual(makeStyle({ bg: 10 }));
        applySgrEscape(style, ansi.sgr(49)); // reset bg
        expect(style).toEqual(makeStyle());
    });

    test('compound set foreground / background (4 bit)', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr(31, 43)); // fg red + bg yellow
        expect(style).toEqual(makeStyle({ fg: 1, bg: 3 }));
        applySgrEscape(style, ansi.sgr(39, 49)); // reset fg + bg
        expect(style).toEqual(makeStyle());
    });

    test('underline escapes with subparams', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr('4:1')); // solid underline
        expect(style).toEqual(makeStyle({ underline: true }));
        applySgrEscape(style, ansi.sgr('4:0')); // reset underline
        expect(style).toEqual(makeStyle());
    });

    test('compound opening & closing sequences', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr(31, 39)); // fg 31 + reset fg
        expect(style).toEqual(makeStyle());
    });

    test('ignore unsupported sgr codes', () => {
        const style = makeStyle();
        applySgrEscape(style, ansi.sgr(73)); // superscript
        expect(style).toEqual(makeStyle());
        applySgrEscape(style, ansi.sgr(75)); // reset superscript
        expect(style).toEqual(makeStyle());
    });

    describe('reset escapes', () => {
        test('reset zero ESC[0m', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr(31, 43)); // fg red + bg yellow
            expect(style).toEqual(makeStyle({ fg: 1, bg: 3 }));
            applySgrEscape(style, ansi.sgr(0)); // reset
            expect(style).toEqual(makeStyle());
        });

        test('implied reset ESC[m', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr(31)); // fg red
            expect(style).toEqual(makeStyle({ fg: 1 }));
            applySgrEscape(style, ansi.sgr('', 43)); // reset + bg yellow
            expect(style).toEqual(makeStyle({ bg: 3 }));
            applySgrEscape(style, ansi.sgr('')); // reset
            expect(style).toEqual(makeStyle());
        });

        test('reset with only colons ESC[:m', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr(31)); // fg red
            expect(style).toEqual(makeStyle({ fg: 1 }));
            applySgrEscape(style, ansi.sgr(':')); // reset ESC[:m
            expect(style).toEqual(makeStyle());
            applySgrEscape(style, ansi.sgr(43)); // bg yellow
            expect(style).toEqual(makeStyle({ bg: 3 }));
            applySgrEscape(style, ansi.sgr('::')); // reset ESC[::m
            expect(style).toEqual(makeStyle());
        });

        test('compound sequence with reset', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr(0, 31)); // reset + fg red
            expect(style).toEqual(makeStyle({ fg: 1 }));
        });

        test('compound opening & implied reset sequence', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr(31, '')); // fg 31 + implied reset
            expect(style).toEqual(makeStyle());
        });
    });

    describe('indexed color sequences (8 bit)', () => {
        test('semicolon (;) delimited subparameters', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr('38;5;93', '48;5;150')); // fg 93 + bg 150
            expect(style).toEqual(makeStyle({ fg: 93, bg: 150 }));
        });

        test('colon (:) delimited subparameters', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr('38:5:93', '48:5:150')); // fg 93 + bg 150
            expect(style).toEqual(makeStyle({ fg: 93, bg: 150 }));
        });

        test('mixed colon (:) & semicolon (;) delimited subparameters', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr('38;5:93', '48;5:150')); // fg 93 + bg 150
            expect(style).toEqual(makeStyle({ fg: 93, bg: 150 }));
        });

        test('implied index arguments', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr('38;5;', '48:5:')); // fg 0 + bg 0
            expect(style).toEqual(makeStyle({ fg: 0, bg: 0 }));
            applySgrEscape(style, ansi.sgr('', '38;5:')); // reset + fg 0
            expect(style).toEqual(makeStyle({ fg: 0 }));
        });

        test('missing index arguments', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr('38;5')); // fg 0
            applySgrEscape(style, ansi.sgr('48:5')); // bg 0
            expect(style).toEqual(makeStyle({ fg: 0, bg: 0 }));
        });

        test('out of bounds index arguments', () => {
            const style = makeStyle();
            // constrain provided color index values (mod 256)
            applySgrEscape(style, ansi.sgr('38;5;300')); // fg index 300
            applySgrEscape(style, ansi.sgr('48:5:256')); // bg index 256
            expect(style).toEqual(makeStyle({ fg: 44, bg: 0 }));
        });
    });

    describe('rgb color sequences (24 bit)', () => {
        test('semicolon (;) delimited subparameters', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr('38;2;168;52;235')); // fg rgb(168, 52, 235)
            applySgrEscape(style, ansi.sgr('48;2;192;230;55')); // bg rgb(192, 230, 55)
            expect(style).toEqual(makeStyle({ fg: [168, 52, 235], bg: [192, 230, 55] }));
        });

        test('colon (:) delimited subparameters', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr('38:2:168:52:235')); // fg rgb(168, 52, 235)
            applySgrEscape(style, ansi.sgr('48:2:192:230:55')); // bg rgb(192, 230, 55)
            expect(style).toEqual(makeStyle({ fg: [168, 52, 235], bg: [192, 230, 55] }));
        });

        test('mixed colon (:) & semicolon (;) delimited subparameters', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr('38;2:168:52:235')); // fg rgb(168, 52, 235)
            applySgrEscape(style, ansi.sgr('48;2;192;230:55')); // bg rgb(192, 230, 55)
            expect(style).toEqual(makeStyle({ fg: [168, 52, 235], bg: [192, 230, 55] }));
        });

        test('implied rgb arguments', () => {
            const style = makeStyle();
            // fg rgb(0, 52, 0) + bg rgb(0, 230, 0)
            applySgrEscape(style, ansi.sgr('38;2;;52;', '48;2;:230:'));
            expect(style).toEqual(makeStyle({ fg: [0, 52, 0], bg: [0, 230, 0] }));
            applySgrEscape(style, ansi.sgr(0)); // reset
            // fg rgb(0, 52, 235) + bg rgb(192, 0, 0)
            applySgrEscape(style, ansi.sgr('38:2::52:235', '48:2:192::'));
            expect(style).toEqual(makeStyle({ fg: [0, 52, 235], bg: [192, 0, 0] }));
        });

        test('missing rgb arguments', () => {
            const style = makeStyle();
            // fg rgb(0, 0, 0) + bg rgb(0, 0, 0)
            applySgrEscape(style, ansi.sgr('38:2', '48;2'));
            expect(style).toEqual(makeStyle({ fg: [0, 0, 0], bg: [0, 0, 0] }));
            applySgrEscape(style, ansi.sgr(0)); // reset
            // fg rgb(168, 0, 0) + bg rgb(192, 230, 0)
            applySgrEscape(style, ansi.sgr('38;2:168', '48;2;192;230'));
            expect(style).toEqual(makeStyle({ fg: [168, 0, 0], bg: [192, 230, 0] }));
        });

        test('out of bounds rgb arguments', () => {
            const style = makeStyle();
            // constrain provided rgb values (mod 256)
            applySgrEscape(style, ansi.sgr('38;2;300;256;200')); // fg rgb(44, 0, 200)
            applySgrEscape(style, ansi.sgr('48:2:192:120394:55')); // bg rgb(192, 74, 55)
            expect(style).toEqual(makeStyle({ fg: [44, 0, 200], bg: [192, 74, 55] }));
        });

        describe('sequences with omitted color space id parameter', () => {
            test('colon (:) delimited subparameters', () => {
                const style = makeStyle();
                // fg rgb(168, 52, 235) + bg rgb(192, 230, 55)
                applySgrEscape(style, ansi.sgr('38:2::168:52:235', '48:2::192:230:55'));
                expect(style).toEqual(makeStyle({ fg: [168, 52, 235], bg: [192, 230, 55] }));
            });

            test('mixed colon (:) & semicolon (;) delimited subparameters', () => {
                const style = makeStyle();
                // fg rgb(168, 52, 235) + bg rgb(192, 230, 55)
                applySgrEscape(style, ansi.sgr('38;2::168:52:235', '48;2;:192:230:55'));
                expect(style).toEqual(makeStyle({ fg: [168, 52, 235], bg: [192, 230, 55] }));
            });

            test('implied rgb arguments', () => {
                const style = makeStyle();
                // fg rgb(0, 52, 0) + bg rgb(192, 0, 55)
                applySgrEscape(style, ansi.sgr('38:2:::52:', '48;2::192::55'));
                expect(style).toEqual(makeStyle({ fg: [0, 52, 0], bg: [192, 0, 55] }));
            });
        });
    });

    describe('unusual or malformed extended color sequences', () => {
        test('ignores unknown color modes', () => {
            const style = makeStyle();
            // only supported color modes are 2 (24 bit) & 5 (8 bit)
            applySgrEscape(style, ansi.sgr('38;7')); // color mode 7
            expect(style).toEqual(makeStyle());
            applySgrEscape(style, ansi.sgr('48:6')); // color mode 6
            expect(style).toEqual(makeStyle());
        });

        test('does not overconsume parameters following unknown color modes', () => {
            const style = makeStyle();
            // code following 38 / 48 can only be 2 / 5
            applySgrEscape(style, ansi.sgr(48, 7, 3)); // italic
            expect(style).toEqual(makeStyle({ italic: true }));
        });

        test('ignores sequences with omitted color modes', () => {
            const style = makeStyle();
            applySgrEscape(style, ansi.sgr(33)); // fg 3
            expect(style).toEqual(makeStyle({ fg: 3 }));
            // ommited argument after 38 or 48 should not be treated as a reset
            applySgrEscape(style, ansi.sgr('38;'));
            expect(style).toEqual(makeStyle({ fg: 3 }));
            applySgrEscape(style, ansi.sgr(48)); // bg ommitted color mode
            expect(style).toEqual(makeStyle({ fg: 3 }));
        });
    });
});