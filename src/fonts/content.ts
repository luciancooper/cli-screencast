import type { TextLine } from '../types';
import { GraphemeSet } from './range';

/**
 * - `0` → Normal
 * - `1` → Bold
 * - `2` → Italic
 * - `3` → Bold-Italic
 */
export type AnsiCode = 0 | 1 | 2 | 3;

export interface ContentSubsets {
    coverage: GraphemeSet
    subsets: [ansi: AnsiCode, subset: GraphemeSet][]
}

export type FrameData = {
    lines: TextLine[]
    title: TextLine | null
} | {
    content: { lines: TextLine[] }[]
    title: TextLine[]
};

function* extractChunks(data: FrameData) {
    if ('content' in data) {
        // ParsedCaptureData
        for (const frame of data.title) {
            yield* frame.chunks;
        }
        for (const frame of data.content) {
            for (const line of frame.lines) {
                yield* line.chunks;
            }
        }
    } else {
        // ParsedScreenData
        if (data.title) yield* data.title.chunks;
        for (const line of data.lines) {
            yield* line.chunks;
        }
    }
}

/**
 * Create a content subset from text grouped by ansi style index
 */
export function createContentSubsets(ansi: string[]): ContentSubsets {
    const subsets: ContentSubsets['subsets'] = [];
    for (const [i, chars] of ansi.entries()) {
        if (chars) subsets.push([i as AnsiCode, GraphemeSet.from(chars)]);
    }
    const coverage = GraphemeSet.merge(...subsets.map(([, chars]) => chars));
    return { coverage, subsets };
}

/**
 * Extract all text from the input frame data grouped by ansi style index
 */
export default function extractContentSubsets(data: FrameData): ContentSubsets {
    const chars: GraphemeSet[] = [];
    for (const { str, style } of extractChunks(data)) {
        if (!str) continue;
        // [strikeThrough, inverse, underline, italic, dim, bold]
        const ansi = (style.props & 1) | ((style.props >>> 1) & 2);
        chars[ansi] = chars[ansi]?.union(str) ?? GraphemeSet.from(str);
    }
    const subsets = [...chars.entries()].filter(([, c]) => c) as [ansi: AnsiCode, subset: GraphemeSet][],
        coverage = GraphemeSet.merge(...subsets.map(([, c]) => c));
    return { coverage, subsets };
}