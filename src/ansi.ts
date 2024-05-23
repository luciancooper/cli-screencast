import ansiRegex from 'ansi-regex';
import type { AnsiStyle, AnsiStyleProps } from './types';
import { toHex, color8Bit } from './color';
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

const sgrRegExp = /(?:[345]8;(?:2(?:;\d*){0,3}|5(?:;\d*)?|\d*)|\d*)[;m]/g;

function parseEscape(style: AnsiStyle, sequence: string) {
    const [, sgr, link] = /[\u001B\u009B](?:\[(\d*(?:;[\d;]+)?m)|\]8;;(.*)\u0007)/.exec(sequence) ?? [];
    // check if this is a hyperlink escape sequence
    if (typeof link === 'string') {
        // if link is an empty string, then this is a closing hyperlink sequence
        style.link = link || undefined;
        return;
    }
    // stop if this is not an sgr code
    if (!sgr) return;
    // split sgr codes
    for (const seq of [...sgr.matchAll(sgrRegExp)].map(([c]) => c.slice(0, -1) || '0')) {
        // test for 38 (foreground) / 48 (background) / 58 (underline) color set code
        if (/^[345]8;/.test(seq)) {
            // underline color is not supported
            if (seq.startsWith('58;')) continue;
            // split seq arguments [34]8;bit;...args
            const [bit, ...args] = seq.split(';').slice(1).map((x) => Number(x || '0')),
                attr = seq.startsWith('38;') ? 'fg' : 'bg';
            if (bit === 2) {
                // true color (24 bit color)
                const [r = 0, g = 0, b = 0] = args;
                style[attr] = toHex([r, g, b]);
            } else if (bit === 5) {
                // xterm 256 color (8 bit color)
                style[attr] = color8Bit(Math.min(args[0] ?? 0, 0xFF));
            }
            continue;
        }
        const code = Number(seq);
        if (code === 0) {
            // reset code
            [style.props, style.fg, style.bg] = [0,,,];
        } else if ([1, 2, 3, 4, 7, 9].includes(code)) {
            // props code (bold, dim, italic, underline, inverse, strikeThrough)
            const i = [1, 2, 3, 4, 7, 9].indexOf(code);
            style.props |= (1 << i);
        } else if ([22, 23, 24, 27, 29].includes(code)) {
            // reset props code
            style.props &= {
                22: 0b111100, // bold & dim off
                23: 0b111011, // italic off
                24: 0b110111, // underline off
                27: 0b101111, // inverse off
                29: 0b011111, // strikeThrough off
            }[code]!;
        } else if (code >= 30 && code <= 37) {
            // foreground color (4 bit)
            style.fg = code % 10;
        } else if (code >= 40 && code <= 47) {
            // background color (4 bit)
            style.bg = code % 10;
        } else if (code >= 90 && code <= 97) {
            // foreground bright color (4 bit)
            style.fg = 8 + (code % 10);
        } else if (code >= 100 && code <= 107) {
            // background bright color (4 bit)
            style.bg = 8 + (code % 10);
        } else if (code === 39) {
            // foreground reset
            style.fg = undefined;
        } else if (code === 49) {
            // background reset
            style.bg = undefined;
        }
        // otherwise, ignore code
    }
}

export interface AnsiChunk {
    chunk: string
    style: AnsiStyle
}

export default function* parseAnsi(string: string): Generator<AnsiChunk> {
    let style: AnsiStyle = { props: 0 },
        queue: string[] = [],
        chunk = '';
    // split ansi chunks
    for (const [str, isEscape] of regexChunks(ansiRegex(), string)) {
        if (isEscape) {
            queue.push(str);
            continue;
        }
        const next: AnsiStyle = { ...style };
        for (const esc of queue) parseEscape(next, esc);
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