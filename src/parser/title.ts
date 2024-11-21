import { stringWidth } from 'tty-strings';
import type { IconID, Title, AnsiStyle, TextChunk, TextLine } from '../types';
import parseAnsi, { stylesEqual } from './ansi';
import icons from '../render/icons.json';

const iconMap = (
    Object.entries(icons) as [IconID, { alias?: string[], path: string }][]
).reduce<Record<string, IconID>>((acc, [key, { alias = [] }]) => {
    for (const k of [key, ...alias]) acc[k] = key;
    return acc;
}, {});

export function matchIcon(string: string, fallback: IconID = 'shell'): IconID {
    const cmd = string.split(' ')[0]!;
    return cmd.length ? (iconMap[cmd] ?? fallback) : fallback;
}

export function parseTitle(title: string): TextLine {
    const chunks: TextChunk[] = [];
    let [x, width, str] = [0, 0, ''],
        chunkStyle: AnsiStyle | null = null;
    for (const { chunk, style } of parseAnsi(title)) {
        const span = stringWidth(chunk);
        if (!span) continue;
        if (chunkStyle) {
            if (stylesEqual(chunkStyle, style)) {
                width += span;
                str += chunk;
                continue;
            }
            chunks.push({ str, x: [x, width], style: chunkStyle });
        }
        [x, width, str, chunkStyle] = [x + width, span, chunk, style];
    }
    if (chunkStyle) {
        chunks.push({ str, x: [x, width], style: chunkStyle });
    }
    return { columns: x + width, chunks };
}

export function resolveTitle(text?: string, icon?: string | boolean): Title | null {
    return (text || icon) ? {
        ...parseTitle(text ?? ''),
        icon: icon ? matchIcon(typeof icon === 'boolean' ? text ?? '' : icon) : null,
    } : null;
}

/**
 * Apply title escape sequence to update title state.
 * - code 0: sets both title and icon
 * - code 1: sets only icon
 * - code 2: sets only title
 */
export function applyTitleEscape(title: Title | null, code: 0 | 1 | 2, value: string): Title | null {
    const icon = code === 2 ? (title?.icon ?? null) : (value ? matchIcon(value) : null),
        text = code === 1 ? title ?? parseTitle('') : parseTitle(value);
    return (text.columns || icon) ? { ...text, icon } : null;
}