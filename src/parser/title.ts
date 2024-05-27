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

export function resolveTitle(text?: string, icon?: string | boolean): Title {
    return {
        text,
        icon: icon ? matchIcon(typeof icon === 'boolean' ? text ?? '' : icon) : undefined,
        ...parseTitle(text ?? ''),
    };
}