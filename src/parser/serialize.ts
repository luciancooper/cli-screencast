import type { TextChunk, TerminalLine, CursorLocation, Title } from '../types';

const escapeString = (str?: string): string => (
    typeof str !== 'string' ? '' : `'${str.replace(/'/g, "\\'")}'`
);

export const chunk = ({ str, style, x: [x, span] }: TextChunk): string => {
    const [fg, bg, link] = [style.fg ?? '', style.bg ?? '', escapeString(style.link)];
    return `(${x}:${span}:${style.props},${fg},${bg},${link}) ${escapeString(str)}`;
};

export const lines = (array: TerminalLine[]): string => (
    array.map(({ chunks }) => chunks.map(chunk).join(' ')).join('\n')
);

export const cursor = (loc: CursorLocation | null) => (
    loc ? `${loc.line}:${loc.column}` : ''
);

export const title = ({ icon, text }: Title) => (
    (icon || text) ? `${icon ?? ''}:${text ?? ''}` : ''
);