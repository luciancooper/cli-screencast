import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import type { RGBA } from './types';
import type { Theme } from './theme';

extend([namesPlugin]);

/**
 * Resolve a color argument.
 * @param color - a color string to parse or an RGBA array
 * @returns an rgba value array
 */
export function resolveColor(color: RGBA | string): RGBA {
    if (typeof color === 'string') {
        const rgb = colord(color).toRgb();
        return [rgb.r, rgb.g, rgb.b, rgb.a];
    }
    const [r, g, b, a = 1] = color;
    return [r, g, b, a];
}

/**
 * Convert RGBA array to a hex triplet string. Hex triplets have six digits, are lower case, and have a leading '#'.
 * @param color - an RGB array to convert
 * @returns a hex triplet string (six-digit, lower case, leading '#')
 */
export function hexString([r, g, b]: RGBA) {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Extract the alpha value from an RGBA array.
 * @param color - an RGBA array
 * @param nullify - whether or not to return undefined if alpha value is 1
 * @returns alpha value
 */
export function alphaValue(rgba: RGBA, nullify: true): number | undefined;
export function alphaValue(rgba: RGBA, nullify?: boolean): number;
export function alphaValue([,,, a]: RGBA, nullify = false) {
    const alpha = Math.max(Math.min(1, (a ?? 1)), 0);
    return (nullify && alpha === 1) ? undefined : alpha;
}

/**
 * Convert 8 bit color to RGB xterm 256 color (8 bit color)
 * {@link https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit}
 * @param color - 8 bit color value (0 - 255)
 * @returns 4 bit color if between 0 - 15, otherwise a hex color string
 */
export function color8Bit(color: number): number | RGBA {
    if (color > 0xFF || color < 0) {
        throw new Error(`${color} is not a valid 8 bit color value`);
    }
    // 0 - 15 : 4 bit color
    if (color < 16) return color;
    // 16 - 231 : 6 × 6 × 6 cube (216 colors)
    if (color < 232) {
        return [
            Math.floor((color - 16) / 36),
            Math.floor(((color - 16) % 36) / 6),
            (color - 16) % 6,
        ].map((i) => i && (95 + (i - 1) * 40)) as [r: number, g: number, b: number];
    }
    // 232 - 255 : grayscale (24 colors)
    const gray = (color - 232) * 10 + 8;
    return [gray, gray, gray];
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

export function themeColor<T extends RGBA | string = string>(
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