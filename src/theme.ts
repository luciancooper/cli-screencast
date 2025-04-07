import type { Entries, RGBA } from './types';
import { resolveColor } from './color';

export interface Theme<Color = RGBA | string> {
    foreground?: Color
    background?: Color
    // ansi colors
    black?: Color
    red?: Color
    green?: Color
    yellow?: Color
    blue?: Color
    magenta?: Color
    cyan?: Color
    white?: Color
    brightBlack?: Color
    brightRed?: Color
    brightGreen?: Color
    brightYellow?: Color
    brightBlue?: Color
    brightMagenta?: Color
    brightCyan?: Color
    brightWhite?: Color
    // title icon
    iconColor?: Color
    // cursor
    cursorColor?: Color
    cursorStyle?: 'beam' | 'block' | 'underline'
    cursorBlink?: boolean
    // ansi style
    dim?: number
}

export const defaultTheme: Required<Theme> = {
    foreground: '#e1e4ea',
    background: '#282a36',
    // ansi colors
    black: '#000000',
    red: '#e60800',
    green: '#26a439',
    yellow: '#cdac08',
    blue: '#0066ff',
    magenta: '#ca30c7',
    cyan: '#00c5c7',
    white: '#cccccc',
    brightBlack: '#464646',
    brightRed: '#ff5c57',
    brightGreen: '#32d74b',
    brightYellow: '#ffd60a',
    brightBlue: '#43a8ed',
    brightMagenta: '#ff77ff',
    brightCyan: '#60fdff',
    brightWhite: '#f2f2f2',
    // title icon
    iconColor: '#d3d7de',
    // cursor
    cursorColor: '#d7d5c9',
    cursorStyle: 'beam',
    cursorBlink: false,
    // ansi style
    dim: 0.5,
};

type ThemeNonColorKeys = { [K in keyof Theme]-?: Required<Theme<never>>[K] extends never ? never : K }[keyof Theme];

const nonColorThemeKeys: ThemeNonColorKeys[] = ['cursorStyle', 'cursorBlink', 'dim'] as const;

export function resolveTheme(spec: Theme = {}) {
    return (Object.entries({ ...defaultTheme, ...spec }) as Entries<Theme>)
        .reduce<Record<string, any>>((acc, [k, v]) => {
            acc[k] = nonColorThemeKeys.includes(k as ThemeNonColorKeys) ? v : resolveColor(v as RGBA | string);
            return acc;
        }, {}) as Required<Theme<RGBA>>;
}