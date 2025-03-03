import { resolveTheme } from '@src/theme';
import { resolveColor, hexString, alphaValue, encodeColor, decodeColor } from '@src/color';

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

describe('encodeColor', () => {
    test('encode indexed color value', () => {
        const encoded = encodeColor(12);
        expect(encoded >>> 24).toBe(1);
        expect(encoded & 0xFF).toBe(12);
    });

    test('encode rgb color value', () => {
        const encoded = encodeColor(192, 230, 55);
        expect(encoded >>> 24).toBe(2);
        expect(encoded & 0xFFFFFF).toBe((192 << 16) | (230 << 8) | 55);
    });
});

describe('decodeColor', () => {
    test('returns undefined if color is undefined', () => {
        expect(decodeColor(undefined, theme)).toBeUndefined();
    });

    test('returns undefined if color is 0', () => {
        expect(decodeColor(0, theme)).toBeUndefined();
    });

    test('decodes 4 bit colors using theme color palette', () => {
        // standard colors (0 - 7)
        expect(decodeColor(encodeColor(2), theme)).toBe(theme.green);
        // high intensity colors (8 - 15)
        expect(decodeColor(encodeColor(12), theme)).toBe(theme.brightBlue);
    });

    test('decodes 8 bit 6 × 6 × 6 cube colors (216 colors)', () => {
        expect(decodeColor(encodeColor(16), theme)).toStrictEqual([0, 0, 0]); // 0 × 0 × 0
        expect(decodeColor(encodeColor(188), theme)).toStrictEqual([215, 215, 215]); // 4 × 4 × 4
        expect(decodeColor(encodeColor(212), theme)).toStrictEqual([255, 135, 215]); // 5 × 2 × 4
    });

    test('decodes 8 bit grayscale colors', () => {
        expect(decodeColor(encodeColor(232), theme)).toStrictEqual([8, 8, 8]); // 0xe8
        expect(decodeColor(encodeColor(245), theme)).toStrictEqual([138, 138, 138]); // 0xf5
        expect(decodeColor(encodeColor(255), theme)).toStrictEqual([238, 238, 238]); // 0xff
    });

    test('decodes 24 bit rgb colors', () => {
        expect(decodeColor(encodeColor(90, 112, 180), theme)).toStrictEqual([90, 112, 180]);
    });
});