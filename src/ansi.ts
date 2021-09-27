import ansiRegex from 'ansi-regex';
import type { Palette, AnsiStyle, AnsiStyleProps } from './types';
import { toHex, color4Bit, color8Bit } from './color';
import { regexChunks } from './utils';

export function expandProps(props: number): AnsiStyleProps {
    return {
        bold: Boolean(props & (1 << 0)),
        dim: Boolean(props & (1 << 1)),
        italic: Boolean(props & (1 << 2)),
        underline: Boolean(props & (1 << 3)),
        inverted: Boolean(props & (1 << 4)),
        strikeThrough: Boolean(props & (1 << 5)),
    };
}

export function stylesEqual(a: AnsiStyle, b: AnsiStyle): boolean {
    return a.props === b.props && a.fg === b.fg && a.bg === b.bg && a.link === b.link;
}

function parseEscape(palette: Palette, style: AnsiStyle, sequence: string): AnsiStyle {
    const [, sgr, link] = /[\u001B\u009B](?:\[(\d+(?:;[\d;]+)?)m|\]8;;(.*)\u0007)/.exec(sequence) ?? [];
    // check if this is a hyperlink escape sequence
    if (typeof link === 'string') {
        // if link is an empty string, then this is a closing hyperlink sequence
        return { ...style, link: link || undefined };
    }
    // stop if this is not an sgr code
    if (!sgr) return style;
    // test for 38 (foreground) / 48 (background) set code
    if (/^[34]8;/.test(sgr)) {
        const [id, ...codes] = sgr.split(';').slice(1).map((x) => Number(x || '0')),
            attr = sgr.startsWith('38;') ? 'fg' : 'bg';
        // true color (24 bit color)
        if (id === 2) {
            const [r = 0, g = 0, b = 0] = codes;
            return { ...style, [attr]: toHex([r, g, b]) };
        }
        // xterm 256 color (8 bit color)
        if (id === 5) {
            const code = Math.min(codes[0] ?? 0, 0xFF);
            return { ...style, [attr]: color8Bit(code, palette) };
        }
        return style;
    }
    let { props, fg, bg } = style;
    for (const code of sgr.split(';').filter(Boolean).map(Number)) {
        if (code === 0) {
            // reset code
            [props, fg, bg] = [0,,,];
        } else if ([1, 2, 3, 4, 7, 9].includes(code)) {
            // props code (bold, dim, italic, underline, inverse, strikeThrough)
            const i = [1, 2, 3, 4, 7, 9].indexOf(code);
            props |= (1 << i);
        } else if ([22, 23, 24, 27, 29].includes(code)) {
            // reset props code
            props &= {
                22: 0b111100, // bold & dim off
                23: 0b111011, // italic off
                24: 0b110111, // underline off
                27: 0b101111, // inverse off
                29: 0b011111, // strikeThrough off
            }[code]!;
        } else if (code >= 30 && code <= 37) {
            // foreground color
            fg = color4Bit(code % 10, palette);
        } else if (code >= 40 && code <= 47) {
            // background color
            bg = color4Bit(code % 10, palette);
        } else if (code >= 90 && code <= 97) {
            // foreground bright color
            fg = color4Bit(8 + (code % 10), palette);
        } else if (code >= 100 && code <= 107) {
            // background bright color
            bg = color4Bit(8 + (code % 10), palette);
        } else if (code === 39) {
            // foreground reset
            fg = undefined;
        } else if (code === 49) {
            // background reset
            bg = undefined;
        }
        // otherwise, ignore code
    }
    return {
        ...style,
        props,
        fg,
        bg,
    };
}

export interface AnsiChunk {
    chunk: string
    style: AnsiStyle
}

export default function* parseAnsi(palette: Palette, string: string): Generator<AnsiChunk> {
    let style: AnsiStyle = { props: 0 },
        queue: string[] = [],
        chunk = '';
    // split ansi chunks
    for (const [str, isEscape] of regexChunks(ansiRegex(), string)) {
        if (isEscape) {
            queue.push(str);
            continue;
        }
        let next = style;
        for (const esc of queue) next = parseEscape(palette, next, esc);
        queue = [];
        if (!stylesEqual(style, next)) {
            if (chunk) yield { chunk, style };
            chunk = '';
            style = next;
        }
        chunk += str;
    }
    // yield the final chunk of string if its length > 0
    if (chunk) yield { chunk, style };
}