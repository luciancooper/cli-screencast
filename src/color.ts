import type { RGB } from './types';
import type { Theme } from './theme';

/**
 * Convert RGB array to a hex triplet string, or normalize a hex triplet string.
 * Normalized hex triplets have six digits, are lower case, and have a leading '#'.
 * @param color - an RGB array to convert or hex string to normalize
 * @returns a hex triplet string (six-digit, lower case, leading '#')
 */
export function toHex(color: RGB | string) {
    if (typeof color === 'string') {
        if (!/^#?(?:[0-9a-f]{6}|[0-9a-f]{3})$/i.test(color)) {
            throw new Error(`invalid hex color string '${color}'`);
        }
        let digits = color.replace(/^#?/, '').toLowerCase();
        if (digits.length === 3) digits = [...digits].map((h) => h + h).join('');
        return `#${digits}`;
    }
    const [r, g, b] = color;
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Convert hex triplet string to RGB array
 * @param color - hex triplet string
 * @returns rgb value array
 */
export function fromHex(color: string): RGB {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color);
    if (!m) throw new Error(`invalid hex color string '${color}'`);
    const hex = m[1]!;
    return (hex.length === 3 ? [...hex].map((h) => parseInt(h + h, 16))
        : hex.match(/.{2}/g)!.map((h) => parseInt(h, 16))) as [number, number, number];
}

/**
 * Convert 8 bit color to RGB xterm 256 color (8 bit color)
 * {@link https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit}
 * @param color - 8 bit color value (0 - 255)
 * @returns 4 bit color if between 0 - 15, otherwise a hex color string
 */
export function color8Bit(color: number): number | string {
    if (color > 0xFF || color < 0) {
        throw new Error(`${color} is not a valid 8 bit color value`);
    }
    // 0 - 15 : 4 bit color
    if (color < 16) return color;
    // 16 - 231 : 6 × 6 × 6 cube (216 colors)
    if (color < 232) {
        return toHex([
            Math.floor((color - 16) / 36),
            Math.floor(((color - 16) % 36) / 6),
            (color - 16) % 6,
        ].map((i) => i && (95 + (i - 1) * 40)) as unknown as RGB);
    }
    // 232 - 255 : grayscale (24 colors)
    const gray = (color - 232) * 10 + 8;
    return toHex([gray, gray, gray]);
}

type ThemeColorKeys = { [K in keyof Theme]: Theme<never>[K] extends never ? K : never }[keyof Theme];

const color4BitKeys: ThemeColorKeys[] = [
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'brightBlack',
    'brightRed',
    'brightGreen',
    'brightYellow',
    'brightBlue',
    'brightMagenta',
    'brightCyan',
    'brightWhite',
];

export function themeColor<T extends RGB | string = string>(
    color: number | T | undefined,
    theme: Theme<T>,
): T | undefined {
    if (typeof color !== 'number') return color;
    // 4 bit colors must be between 0 - 15
    if (color > 0xF || color < 0) {
        throw new Error(`${color} is not a valid 4 bit color value`);
    }
    return theme[color4BitKeys[color]!];
}