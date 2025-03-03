import { ansiRegex, stringWidth } from 'tty-strings';
import type { IconID, Title, AnsiStyle, TextChunk, TextLine } from '../types';
import { regexChunks } from './utils';
import { stylesEqual } from './style';
import { applySgrEscape } from './sgr';
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
    let [x, width, chunk] = [0, 0, ''],
        style: AnsiStyle = { props: 0, fg: 0, bg: 0 },
        escQueue: string[] = [];
    // split escape chunks
    for (const [str, isEscape] of regexChunks(ansiRegex(), title)) {
        if (isEscape) {
            escQueue.push(str);
            continue;
        }
        // get the visual width of this chunk
        const span = stringWidth(str);
        if (!span) continue;
        // process the escape queue
        const next: AnsiStyle = { ...style };
        for (const esc of escQueue) applySgrEscape(next, esc);
        escQueue = [];
        if (stylesEqual(style, next)) {
            width += span;
            chunk += str;
            continue;
        }
        // add processed chunk if it has visual width
        if (width) chunks.push({ str: chunk, x: [x, width], style });
        [x, width, chunk, style] = [x + width, span, str, next];
    }
    // add final chunk if it has visual width
    if (width) chunks.push({ str: chunk, x: [x, width], style });
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