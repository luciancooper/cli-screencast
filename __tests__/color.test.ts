import { resolveTheme } from '@src/theme';
import { resolveColor, hexString, alphaValue, themeColor, color8Bit } from '@src/color';

const theme = resolveTheme();

describe('resolveColor', () => {
    test('converts hex string to rgb', () => {
        expect(resolveColor('#ff00ff')).toStrictEqual([255, 0, 255, 1]);
        expect(resolveColor('#5a70b4')).toStrictEqual([90, 112, 180, 1]);
        expect(resolveColor('#FFeeFF')).toStrictEqual([255, 238, 255, 1]);
    });

    test('handles shorted hex strings', () => {
        expect(resolveColor('#f0f')).toStrictEqual([255, 0, 255, 1]);
        expect(resolveColor('#eee')).toStrictEqual([238, 238, 238, 1]);
    });

    test('parses rgba strings', () => {
        expect(resolveColor('rgba(150, 0, 255, 0.5)')).toStrictEqual([150, 0, 255, 0.5]);
    });

    test('parses hsla strings', () => {
        expect(resolveColor('hsla(0, 50%, 50%, 25%)')).toStrictEqual([191, 64, 64, 0.25]);
    });

    test('resolves rgb arrays', () => {
        expect(resolveColor([255, 150, 100])).toStrictEqual([255, 150, 100, 1]);
    });
});

describe('hexString', () => {
    test('converts rgb arrays to hex triplet strings', () => {
        expect(hexString([255, 0, 255])).toBe('#ff00ff');
    });

    test('ignores alpha values', () => {
        expect(hexString([255, 0, 255, 0.5])).toBe('#ff00ff');
    });
});

describe('alphaValue', () => {
    test('extracts alpha value from an rgba array', () => {
        expect(alphaValue([255, 0, 255, 0.25])).toBe(0.25);
        expect(alphaValue([255, 155, 155])).toBe(1);
    });

    test('returns undefined on full alpha values if `nullify` is true', () => {
        expect(alphaValue([255, 155, 155, 0.5], true)).toBe(0.5);
        expect(alphaValue([255, 155, 155, 1], true)).toBeUndefined();
        expect(alphaValue([255, 155, 155], true)).toBeUndefined();
    });
});

describe('themeColor', () => {
    test('does nothing if color is an rgba tuple or undefined', () => {
        expect(themeColor([254, 254, 254], theme)).toStrictEqual([254, 254, 254]);
        expect(themeColor(undefined, theme)).toBeUndefined();
    });

    test('throws an error if input is a number not between 0 - 15', () => {
        expect(() => themeColor(-1, theme)).toThrow('-1 is not a valid 4 bit color value');
        expect(() => themeColor(16, theme)).toThrow('16 is not a valid 4 bit color value');
    });

    test('converts 4 bit colors to color strings', () => {
        // standard colors (0 - 7)
        expect(themeColor(0x2, theme)).toBe(theme.green);
        // high intensity colors (8 - 15)
        expect(themeColor(0xC, theme)).toBe(theme.brightBlue);
    });
});

describe('color8Bit', () => {
    test('throws an error if input is not between 0 - 255', () => {
        expect(() => color8Bit(-5)).toThrow('-5 is not a valid 8 bit color value');
        expect(() => color8Bit(260)).toThrow('260 is not a valid 8 bit color value');
    });

    test('4 bit standard colors (0-7)', () => {
        expect(color8Bit(0x3)).toBe(0x3);
    });

    test('4 bit high intensity colors (8-15)', () => {
        expect(color8Bit(0xE)).toBe(0xE);
    });

    test('16-231 6 × 6 × 6 cube (216 colors)', () => {
        expect(color8Bit(16)).toStrictEqual([0, 0, 0]); // 0 × 0 × 0
        expect(color8Bit(188)).toStrictEqual([215, 215, 215]); // 4 × 4 × 4
        expect(color8Bit(212)).toStrictEqual([255, 135, 215]); // 5 × 2 × 4
    });

    test('232-255 - grayscale from black to white in 24 steps', () => {
        expect(color8Bit(232)).toStrictEqual([8, 8, 8]); // 0xe8
        expect(color8Bit(245)).toStrictEqual([138, 138, 138]); // 0xf5
        expect(color8Bit(255)).toStrictEqual([238, 238, 238]); // 0xff
    });
});