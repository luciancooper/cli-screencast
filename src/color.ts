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

const enum ColorModel {
    INDEX = 0x1000000, // bit 25
    RGB = 0x2000000, // bit 26
}

/**
 * Encode an RGB color
 * @param r - red channel value
 * @param g - green channel value
 * @param b - blue channel value
 */
export function encodeColor(r: number, g: number, b: number): number;
/**
 * Encode an indexed color
 * @param index - color index between 0 - 255
 */
export function encodeColor(index: number): number;
export function encodeColor(...args: number[]): number {
    if (args.length === 1) {
        const [index] = args as [number];
        return ColorModel.INDEX | (index & 0xFF);
    }
    const [r, g, b] = args as [number, number, number];
    return ColorModel.RGB | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
}

type ThemeColorKeys = { [K in keyof Theme]-?: Required<Theme<never>>[K] extends never ? K : never }[keyof Theme];

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

export function decodeColor(color: number | undefined, theme: Required<Theme<RGBA>>): RGBA | undefined {
    if (typeof color !== 'number') return color;
    // handle rgb color model
    if (color & ColorModel.RGB) {
        return [(color >> 16) & 0xFF, (color >> 8) & 0xFF, color & 0xFF];
    }
    // decode indexed color model
    if (color & ColorModel.INDEX) {
        const index = color & 0xFF;
        // 0 - 15 : 4 bit color
        if (index <= 0xF) return theme[color4BitKeys[index]!];
        // Convert 8 bit color to RGB xterm 256 color (https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit)
        if (index < 232) {
            // 16 - 231 : 6 × 6 × 6 cube (216 colors)
            return [
                Math.floor((index - 16) / 36),
                Math.floor(((index - 16) % 36) / 6),
                (index - 16) % 6,
            ].map((i) => i && (95 + (i - 1) * 40)) as [r: number, g: number, b: number];
        }
        // 232 - 255 : grayscale (24 colors)
        const gray = (index - 232) * 10 + 8;
        return [gray, gray, gray];
    }
    return undefined;
}