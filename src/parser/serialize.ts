import type { TextChunk, TerminalLine, CursorLocation, CursorState, Title } from '../types';

const escapeString = (str?: string): string => (
    typeof str !== 'string' ? '' : `'${str.replace(/'/g, "\\'")}'`
);

export const chunk = ({ str, style, x: [x, span] }: TextChunk): string => (
    `(${x}:${span}:${style.props},${style.fg},${style.bg},${escapeString(style.link)}) ${escapeString(str)}`
);

export const lines = (array: TerminalLine[]): string => (
    array.map(({ chunks }) => chunks.map(chunk).join(' ')).join('\n')
);

export const cursor = (data: CursorState | CursorLocation) => {
    const loc = `${data.line}:${data.column}`;
    return ('visible' in data && !data.visible) ? `(${loc})` : `[${loc}]`;
};

export const title = (data: Title | null) => (
    data ? `${data.icon ?? ''}:${data.chunks.map(chunk).join(' ')}` : ''
);