import { stringWidth } from 'tty-strings';
import type { OmitStrict, AnsiStyle, AnsiStyleProps, CursorLocation, TextChunk, TextLine } from '@src/types';

export type StylePartial = OmitStrict<AnsiStyle, 'props'> & Partial<AnsiStyleProps>;

export function makeStyle({
    bold,
    dim,
    italic,
    underline,
    inverted,
    strikeThrough,
    ...style
}: StylePartial = {}): AnsiStyle {
    return {
        props: [bold, dim, italic, underline, inverted, strikeThrough]
            .map((b, i) => Number(b ?? false) << i)
            .reduce((a, b) => a | b),
        ...style,
    };
}

export function makeCursor(line: number, column: number, hidden = false): CursorLocation {
    return { line, column, hidden };
}

export function makeLine(...args: (string | number | undefined | [string, StylePartial])[]): TextLine {
    let x = 0;
    const chunks: TextChunk[] = [];
    for (const arg of args) {
        if (arg == null) continue;
        if (typeof arg !== 'number') {
            let style: StylePartial = {},
                str: string;
            if (typeof arg === 'string') str = arg;
            else [str, style] = arg;
            const span = stringWidth(str);
            chunks.push({ str, style: makeStyle(style), x: [x, span] });
            x += span;
        } else x += arg;
    }
    return { columns: x, chunks };
}