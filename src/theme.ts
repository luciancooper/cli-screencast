import type { Entries, RGBA } from './types';
import { resolveColor } from './color';

type CursorType = 'beam' | 'block' | 'underline';

export interface Theme<Color = RGBA | string> {
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
    iconColor: Color
    // other
    text: Color
    // cursor
    cursorColor: Color
    cursorType: CursorType
    cursorBlink: boolean
    // ansi style
    dim: number
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
    iconColor: [211, 215, 222],
    // other
    text: [185, 192, 203],
    // cursor
    cursorColor: [215, 213, 201],
    cursorType: 'beam',
    cursorBlink: false,
    // ansi style
    dim: 0.5,
};

type ThemeNonColorKeys = { [K in keyof Theme]: Theme<never>[K] extends never ? never : K }[keyof Theme];

const nonColorThemeKeys: ThemeNonColorKeys[] = ['cursorType', 'cursorBlink', 'dim'] as const;

export function resolveTheme(spec: Partial<Theme> = {}) {
    return (Object.entries({ ...defaultTheme, ...spec }) as Entries<Theme>)
        .reduce<Record<string, any>>((acc, [k, v]) => {
        acc[k] = nonColorThemeKeys.includes(k as ThemeNonColorKeys) ? v : resolveColor(v as RGBA | string);
        return acc;
    }, {}) as Theme<RGBA>;
}