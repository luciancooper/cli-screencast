import type { RGBA, TextChunk, TerminalLine, CursorState, Title } from '../types';
import { hexString } from '../color';

const escapeString = (str?: string): string => (
    typeof str !== 'string' ? '' : `'${str.replace(/'/g, "\\'")}'`
);

const colorString = (color?: number | RGBA) => (
    typeof color === 'number' ? color : color ? hexString(color) : ''
);

export const chunk = ({ str, style, x: [x, span] }: TextChunk): string => {
    const [fg, bg, link] = [colorString(style.fg), colorString(style.bg), escapeString(style.link)];
    return `(${x}:${span}:${style.props},${fg},${bg},${link}) ${escapeString(str)}`;
};

export const lines = (array: TerminalLine[]): string => (
    array.map(({ chunks }) => chunks.map(chunk).join(' ')).join('\n')
);

export const cursor = ({ line, column, visible }: CursorState) => {
    const loc = `${line}:${column}`;
    return visible ? `[${loc}]` : `(${loc})`;
};

export const title = (data: Title | null) => (
    data ? `${data.icon ?? ''}:${data.chunks.map(chunk).join(' ')}` : ''
);