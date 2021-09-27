import type { TextChunk, TerminalLine, CursorLocation, Title } from './types';

const escapeString = (str?: string): string => (
    typeof str !== 'string' ? '' : `'${str.replace(/'/g, "\\'")}'`
);

const chunk = ({ str, style, x: [x, span] }: TextChunk): string => {
    const [fg, bg, link] = [style.fg ?? '', style.bg ?? '', escapeString(style.link)];
    return `(${x}:${span}:${style.props},${fg},${bg},${link}) ${escapeString(str)}`;
};

const lines = (array: TerminalLine[]): string => (
    array.map(({ chunks }) => chunks.map(chunk).join(' ')).join('\n')
);

const cursor = ({ hidden, line: l, column: c }: CursorLocation) => (
    hidden ? '' : `${l}:${c}`
);

const title = ({ icon, text }: Title) => (
    (icon || text) ? `${icon ?? ''}:${text ?? ''}` : ''
);

export default {
    chunk,
    lines,
    cursor,
    title,
};