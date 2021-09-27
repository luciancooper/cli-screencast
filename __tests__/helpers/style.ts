import type { OmitStrict, AnsiStyle, AnsiStyleProps } from '@src/types';

export type StylePartial = OmitStrict<AnsiStyle, 'props'> & Partial<AnsiStyleProps>;

export default function makeStyle(style: StylePartial = {}): AnsiStyle {
    return {
        props: [style.bold, style.dim, style.italic, style.underline, style.inverted, style.strikeThrough]
            .map((b, i) => Number(b ?? false) << i)
            .reduce((a, b) => a | b),
        fg: style.fg,
        bg: style.bg,
        link: style.link,
    };
}