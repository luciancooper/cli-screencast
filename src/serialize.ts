import type { TextChunk, TerminalLine, CursorLocation } from './types';

const text = (str?: string): string => (
    typeof str !== 'string' ? '' : `'${str.replace(/'/g, "\\'")}'`
);

const chunk = ({ str, style, x: [x, span] }: TextChunk): string => {
    const attrs = [style.bold, style.dim, style.italic, style.underline, style.inverted, style.strikeThrough]
            .map((b, i) => (b ? 1 << i : 0))
            .reduce((mask, bit) => mask | bit, 0),
        [fg, bg, link] = [style.foreground ?? '', style.background ?? '', text(style.link)];
    return `(${x}:${span}:${attrs},${fg},${bg},${link}) ${text(str)}`;
};

const lines = (array: TerminalLine[]): string => (
    array.map(({ chunks }) => chunks.map(chunk).join(' ')).join('\n')
);

const cursor = ({ hidden, line: l, column: c }: CursorLocation) => (
    hidden ? '' : `${l}:${c}`
);

export default { chunk, lines, cursor };