import type { TextChunk, TerminalLine, CursorLocation } from './types';

const text = (str?: string): string => (
    typeof str !== 'string' ? '' : `'${str.replace(/'/g, "\\'")}'`
);

const chunk = ({ str, style, x: [x, span] }: TextChunk): string => {
    const [fg, bg, link] = [style.fg ?? '', style.bg ?? '', text(style.link)];
    return `(${x}:${span}:${style.props},${fg},${bg},${link}) ${text(str)}`;
};

const lines = (array: TerminalLine[]): string => (
    array.map(({ chunks }) => chunks.map(chunk).join(' ')).join('\n')
);

const cursor = ({ hidden, line: l, column: c }: CursorLocation) => (
    hidden ? '' : `${l}:${c}`
);

export default { chunk, lines, cursor };