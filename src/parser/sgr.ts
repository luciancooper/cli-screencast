import type { AnsiStyle } from '../types';
import { encodeColor } from '../color';
import { Props } from './style';

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

function extractColor(params: number[], subparams: [number, ...number[]] | null): number | null {
    if (!params.length) {
        // if there are no subparams, no color model was provided (ie 38)
        if (!subparams) return 0;
        // extract color model from first subparam
        let [cm, ...args] = subparams;
        if (cm === 2) {
            // check for additional color space id subparam (ie 38:2::R:G:B)
            if (args.length >= 4 && args[0] === -1) args = args.slice(1);
            // normalize rgb values
            const [r = 0, g = 0, b = 0] = args.map((a) => Math.max(a, 0));
            return encodeColor(r, g, b);
        }
        if (cm === 5) {
            return encodeColor(Math.max(args[0] ?? -1, 0));
        }
        return null;
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
        const [r = 0, g = 0, b = 0] = rgb.map((a) => Math.max(a, 0));
        return encodeColor(r, g, b);
    }
    if (cm === 5) {
        // next param (ie 38;5; or 38;5;n) or first subparam (ie 38;5:n or 38;5:)
        return encodeColor(Math.max(args[0] ?? subparams?.[0] ?? -1, 0));
    }
    return null;
}

export function applySgrEscape(style: AnsiStyle, escape: string) {
    let paramString: string;
    // check if escape arg is already a param string
    if (/^[\x30-\x3b]*$/.test(escape)) {
        paramString = escape;
    } else {
        // matches parameter portion of the sgr escape sequence
        const match = /^(?:\x1b\x5b|\x9b)([\x30-\x3b]*)m$/.exec(escape);
        if (!match) return;
        paramString = match[1]!;
    }
    // parse sgr params
    const params = parseSgrParams(paramString);
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
            if (color === null || param.value === 58) continue;
            // apply extended color fg / bg sequence
            style[param.value === 38 ? 'fg' : 'bg'] = color;
            continue;
        }
        // check for closing underline escape '4:0'
        if (param.value === 4 && param.subparams?.[0] === 0) {
            // underline off
            style.props &= ~Props.UNDERLINE;
            continue;
        }
        // omitted parameters (-1) default to 0 (ZDM)
        const code = Math.max(param.value, 0);
        if (code === 0) {
            // reset code
            [style.props, style.fg, style.bg] = [0, 0, 0];
        } else if ([1, 2, 3, 4, 7, 9].includes(code)) {
            // props code
            style.props |= {
                1: Props.BOLD,
                2: Props.DIM,
                3: Props.ITALIC,
                4: Props.UNDERLINE,
                7: Props.INVERSE,
                9: Props.STRIKETHROUGH,
            }[code]!;
        } else if ([22, 23, 24, 27, 29].includes(code)) {
            // reset props code
            style.props &= {
                22: ~(Props.BOLD | Props.DIM),
                23: ~Props.ITALIC,
                24: ~Props.UNDERLINE,
                27: ~Props.INVERSE,
                29: ~Props.STRIKETHROUGH,
            }[code]!;
        } else if (code >= 30 && code <= 37) {
            // foreground color (4 bit)
            style.fg = encodeColor(code % 10);
        } else if (code >= 40 && code <= 47) {
            // background color (4 bit)
            style.bg = encodeColor(code % 10);
        } else if (code >= 90 && code <= 97) {
            // foreground bright color (4 bit)
            style.fg = encodeColor((code % 10) | 8);
        } else if (code >= 100 && code <= 107) {
            // background bright color (4 bit)
            style.bg = encodeColor((code % 10) | 8);
        } else if (code === 39) {
            // foreground reset
            style.fg = 0;
        } else if (code === 49) {
            // background reset
            style.bg = 0;
        }
        // otherwise, ignore code
    }
}