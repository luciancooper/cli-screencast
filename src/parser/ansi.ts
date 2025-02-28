import { ansiRegex } from 'tty-strings';
import type { AnsiStyle, AnsiStyleProps } from '../types';
import { color8Bit } from '../color';
import { regexChunks } from './utils';

export function expandAnsiProps(props: number): AnsiStyleProps {
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

interface SGRParam {
    value: number
    subparams?: [number, ...number[]]
}

/**
 * Parse an SGR sequence parameter string
 * @param str - SGR parameter string, consisting of numerical digits (0 - 9) and delimeters : & ;
 */
function parseSgrParams(str: string): SGRParam[] {
    let digitIsSub = false,
        current: SGRParam = { value: -1 };
    const params: SGRParam[] = [current];
    for (let i = 0; i < str.length; i += 1) {
        const code = str.charCodeAt(i);
        switch (code) {
            case 0x3b: // semicolon ;
                digitIsSub = false;
                current = { value: -1 };
                params.push(current);
                break;
            case 0x3a: // colon :
                digitIsSub = true;
                if (current.subparams) current.subparams.push(-1);
                else current.subparams = [-1];
                break;
            default: {
                // digit 0x30 - 0x39
                const digit = code - 48;
                if (digitIsSub) {
                    const sub = current.subparams!,
                        cur = sub[sub.length - 1]!;
                    sub[sub.length - 1] = ~cur ? cur * 10 + digit : digit;
                } else current.value = ~current.value ? current.value * 10 + digit : digit;
                break;
            }
        }
    }
    return params;
}

type ExtendedColor = [2, r: number, g: number, b: number] | [5, n: number] | number;

function extractColor(params: number[], subparams: [number, ...number[]] | null): ExtendedColor {
    if (!params.length) {
        // if there are no subparams, no color model was provided (ie 38)
        if (!subparams) return 0;
        // extract color model from first subparam
        let [cm, ...args] = subparams;
        if (cm === 2) {
            // check for additional color space id subparam (ie 38:2::R:G:B)
            if (args.length >= 4 && args[0] === -1) args = args.slice(1);
            // normalize rgb values
            const [r = 0, g = 0, b = 0] = args.map((a) => Math.min(Math.max(a, 0), 0xFF));
            return [cm, r, g, b];
        }
        if (cm === 5) {
            return [cm, Math.min(Math.max(args[0] ?? -1, 0), 0xFF)];
        }
        return Math.max(cm, 0);
    }
    // get color model from params
    const [cm, ...args] = params as [number, ...number[]];
    if (cm === 2) {
        let rgb: number[];
        // determine rgb args
        if (args.length) {
            if (args.length === 1 && args[0] === -1 && subparams && subparams.length >= 3) {
                // omitted color space id scenario (ie 38;2;:R:G:B)
                rgb = subparams;
            } else {
                // otherwise, we can have a mix of parameters and subparameters (ie 38;2;R;G;B or 32;2;R:G:B)
                rgb = [...args, ...(subparams ?? [])];
            }
        } else if (subparams) {
            // rgb values are in subparams
            rgb = subparams;
            // check for additional color space id subparam (ie 38;2::R:G:B)
            if (rgb.length >= 4 && rgb[0] === -1) rgb = rgb.slice(1);
        } else {
            // there are no subparams, sequence ends here (ie 38;2)
            rgb = [];
        }
        // normalize rgb values
        const [r = 0, g = 0, b = 0] = rgb.map((a) => Math.min(Math.max(a, 0), 0xFF));
        return [cm, r, g, b];
    }
    if (cm === 5) {
        // next param (ie 38;5; or 38;5;n) or first subparam (ie 38;5:n or 38;5:)
        return [cm, Math.min(Math.max(args[0] ?? subparams?.[0] ?? -1, 0), 0xFF)];
    }
    return Math.max(cm, 0);
}

// regex for matching either sgr escapes and osc link escapes
const sgrLinkRegex = /(?:(?:\x1b\x5b|\x9b)([\x30-\x3b]*m)|(?:\x1b\x5d|\x9d)8;(.*?)(?:\x1b\x5c|[\x07\x9c]))/;

function parseEscape(style: AnsiStyle, sequence: string) {
    // matches an sgr escape sequence or a osc hyperlink sequence
    const [, sgr, link] = sgrLinkRegex.exec(sequence) ?? [];
    // check if this is a hyperlink escape sequence
    if (typeof link === 'string') {
        // escape follows this pattern: OSC 8 ; [params] ; [url] ST, so params portion must be removed to get the url
        const url = link.replace(/^[^;]*;/, '');
        // if url is an empty string, then this is a closing hyperlink sequence
        if (url !== link) style.link = url || undefined;
        return;
    }
    // stop if this is not an sgr code
    if (!sgr) return;
    // parse sgr params
    const params = parseSgrParams(sgr.slice(0, -1));
    // process each param
    for (let i = 0; i < params.length; i += 1) {
        const param = params[i]!;
        if (param.value === 38 || param.value === 48 || param.value === 58) {
            // make array to store accumulated param values
            const args: number[] = [];
            // store next subparam sequence
            let subparams = param.subparams ?? null;
            // if there are no subparams, this sequence will span multiple params
            if (!subparams) {
                // move to next param
                i += 1;
                // consume next param to get color model
                let next = params[i];
                // determine how many params need to be consumed based on the color model (only 2 & 5 are supported)
                const count = next?.value === 2 ? 3 : next?.value === 5 ? 1 : 0;
                // consume params
                for (let n = 0; next && !next.subparams && n < count; n += 1, i += 1, next = params[i]) {
                    args.push(next.value);
                }
                // add last param value to args list
                if (next) {
                    args.push(next.value);
                    subparams = next.subparams ?? null;
                }
            }
            // extract color from args & subparams
            const color = extractColor(args, subparams);
            // continue if code is 58 (underline), or if the color model is not 8 or 24 bit
            if (typeof color === 'number' || param.value === 58) continue;
            // apply extended color fg / bg sequence
            const attr = param.value === 38 ? 'fg' : 'bg';
            if (color[0] === 2) {
                // true color (24 bit color)
                const [, r, g, b] = color;
                style[attr] = [r, g, b];
            } else if (color[0] === 5) {
                // xterm 256 color (8 bit color)
                const [, n] = color;
                style[attr] = color8Bit(n);
            }
            continue;
        }
        // check for closing underline escape '4:0'
        if (param.value === 4 && param.subparams?.[0] === 0) {
            // underline off
            style.props &= ~0b1000;
            continue;
        }
        // omitted parameters (-1) default to 0 (ZDM)
        const code = Math.max(param.value, 0);
        if (code === 0) {
            // reset code
            [style.props, style.fg, style.bg] = [0,,,];
        } else if ([1, 2, 3, 4, 7, 9].includes(code)) {
            // props code (bold, dim, italic, underline, inverse, strikeThrough)
            const idx = [1, 2, 3, 4, 7, 9].indexOf(code);
            style.props |= (1 << idx);
        } else if ([22, 23, 24, 27, 29].includes(code)) {
            // reset props code
            style.props &= {
                22: ~0b11, // bold & dim off
                23: ~0b100, // italic off
                24: ~0b1000, // underline off
                27: ~0b10000, // inverse off
                29: ~0b100000, // strikeThrough off
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