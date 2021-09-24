import type { Entries, RGB, Palette } from './types';
import { toHex } from './color';

type CursorType = 'beam' | 'block' | 'underline';

export interface Theme<Color = RGB | string> {
    // colors
    black: Color
    red: Color
    green: Color
    yellow: Color
    blue: Color
    magenta: Color
    cyan: Color
    white: Color
    brightBlack: Color
    brightRed: Color
    brightGreen: Color
    brightYellow: Color
    brightBlue: Color
    brightMagenta: Color
    brightCyan: Color
    brightWhite: Color
    // window
    background: Color
    // other
    text: Color
    // cursor
    cursorColor: Color
    cursorType: CursorType
    cursorBlink: boolean
    // ansi style
    dim: number
    // font
    fontFamily: string
}

export const defaultTheme: Theme = {
    // colors
    black: [0, 0, 0],
    red: [255, 92, 87],
    green: [90, 247, 142],
    yellow: [243, 249, 157],
    blue: [87, 199, 255],
    magenta: [215, 106, 255],
    cyan: [154, 237, 254],
    white: [241, 241, 240],
    brightBlack: [104, 104, 104],
    brightRed: [255, 92, 87],
    brightGreen: [90, 247, 142],
    brightYellow: [243, 249, 157],
    brightBlue: [87, 199, 255],
    brightMagenta: [215, 106, 255],
    brightCyan: [154, 237, 254],
    brightWhite: [241, 241, 240],
    // window
    background: [40, 42, 54],
    // other
    text: [185, 192, 203],
    // cursor
    cursorColor: [215, 213, 201],
    cursorType: 'beam',
    cursorBlink: false,
    // ansi style
    dim: 0.5,
    // font
    fontFamily: 'Monaco',
};

const color4BitKeys = [
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
] as const;

export function toPalette<T>(theme: Theme<T>): Palette<T> {
    return color4BitKeys.map((k) => theme[k]) as Palette<T>;
}

export function resolveTheme(spec: Partial<Theme> = {}) {
    const theme = (Object.entries({ ...defaultTheme, ...spec }) as Entries<Theme>)
        .reduce<Record<string, any>>((acc, [key, value]) => {
        acc[key] = typeof value === 'object' ? toHex(value) : value;
        return acc;
    }, {}) as Theme<string>;
    return { theme, palette: toPalette(theme) };
}