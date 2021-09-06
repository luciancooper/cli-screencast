import { resolveTheme } from '@src/theme';
import { toHex, fromHex, color4Bit, color8Bit, invert } from '@src/color';

const { palette, theme } = resolveTheme();

describe('toHex', () => {
    test('converts rgb arrays to hex triplet strings', () => {
        expect(toHex([255, 0, 255])).toBe('#ff00ff');
    });

    test('normalizes hex triplet strings', () => {
        expect(toHex('#efe')).toBe('#eeffee');
        expect(toHex('ff00ff')).toBe('#ff00ff');
        expect(toHex('#FFeeFF')).toBe('#ffeeff');
    });

    test('throws error if input hex string is invalid', () => {
        expect(() => toHex('xxyyzz')).toThrow("invalid hex color string 'xxyyzz'");
    });
});

describe('fromHex', () => {
    test('converts hex string to rgb', () => {
        expect(fromHex('ff00ff')).toEqual([255, 0, 255]);
        expect(fromHex('#5a70b4')).toEqual([90, 112, 180]);
    });

    test('handles shorted hex strings', () => {
        expect(fromHex('f0f')).toEqual([255, 0, 255]);
        expect(fromHex('#eee')).toEqual([238, 238, 238]);
    });

    test('throws error if input hex color is invalid', () => {
        expect(() => fromHex('f00ff')).toThrow("invalid hex color string 'f00ff'");
    });
});

describe('color4Bit', () => {
    test('throws an error if input is not between 0 - 15', () => {
        expect(() => color4Bit(-1, palette)).toThrow('-1 is not a valid 4 bit color value');
        expect(() => color4Bit(16, palette)).toThrow('16 is not a valid 4 bit color value');
    });

    test('standard colors (0 - 7)', () => {
        expect(color4Bit(0x2, palette)).toBe(theme.green);
    });

    test('high intensity colors (8 - 15)', () => {
        expect(color4Bit(0xC, palette)).toBe(theme.brightBlue);
    });
});

describe('color8Bit', () => {
    test('throws an error if input is not between 0 - 255', () => {
        expect(() => color8Bit(-5, palette)).toThrow('-5 is not a valid 8 bit color value');
        expect(() => color8Bit(260, palette)).toThrow('260 is not a valid 8 bit color value');
    });

    test('0-7 - standard colors', () => {
        expect(color8Bit(0x3, palette)).toBe(theme.yellow);
    });

    test('8-15 - high intensity colors', () => {
        expect(color8Bit(0xE, palette)).toBe(theme.brightCyan);
    });

    test('16-231 6 × 6 × 6 cube (216 colors)', () => {
        expect(color8Bit(16, palette)).toBe(toHex([0, 0, 0])); // 0 × 0 × 0
        expect(color8Bit(188, palette)).toBe(toHex([215, 215, 215])); // 4 × 4 × 4
        expect(color8Bit(212, palette)).toBe(toHex([255, 135, 215])); // 5 × 2 × 4
    });

    test('232-255 - grayscale from black to white in 24 steps', () => {
        expect(color8Bit(232, palette)).toBe(toHex([8, 8, 8])); // 0xe8
        expect(color8Bit(245, palette)).toBe(toHex([138, 138, 138])); // 0xf5
        expect(color8Bit(255, palette)).toBe(toHex([238, 238, 238])); // 0xff
    });
});

describe('invert', () => {
    test('inverts hex color triplets', () => {
        expect(invert('#000000')).toEqual('#ffffff');
    });

    test('inverts RGB arrays', () => {
        expect(invert([255, 255, 255])).toEqual('#000000');
    });
});