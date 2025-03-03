import type { AnsiStyle, AnsiStyleProps } from '../types';

export const enum Props {
    BOLD = 0x01, // bit 1
    DIM = 0x02, // bit 2
    ITALIC = 0x04, // bit 3
    UNDERLINE = 0x08, // bit 4
    INVERSE = 0x10, // bit 5
    STRIKETHROUGH = 0x20, // bit 6
}

export function expandStyleProps(props: number): AnsiStyleProps {
    return {
        bold: Boolean(props & Props.BOLD),
        dim: Boolean(props & Props.DIM),
        italic: Boolean(props & Props.ITALIC),
        underline: Boolean(props & Props.UNDERLINE),
        inverted: Boolean(props & Props.INVERSE),
        strikeThrough: Boolean(props & Props.STRIKETHROUGH),
    };
}

export function stylesEqual(a: AnsiStyle, b: AnsiStyle): boolean {
    return a.props === b.props && a.fg === b.fg && a.bg === b.bg && a.link === b.link;
}