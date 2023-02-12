import type { TerminalLines, Title } from '../types';
import CodePointRange from './range';

/**
 * - `0` → Normal
 * - `1` → Bold
 * - `2` → Italic
 * - `3` → Bold-Italic
 */
export type AnsiCode = 0 | 1 | 2 | 3;

export interface ContentSubsets {
    coverage: CodePointRange
    subsets: [AnsiCode, CodePointRange][]
}

type TermScreen = TerminalLines & { title: Title };

export type FrameData = TermScreen | TermScreen[] | { content: TerminalLines[], title: Title[] };

function* extractChunks(data: FrameData) {
    if (Array.isArray(data)) {
        // ScreenData[]
        for (const frame of data) {
            yield* frame.title.chunks;
            for (const line of frame.lines) {
                yield* line.chunks;
            }
        }
    } else if ('content' in data) {
        // CaptureData
        for (const frame of data.title) {
            yield* frame.chunks;
        }
        for (const frame of data.content) {
            for (const line of frame.lines) {
                yield* line.chunks;
            }
        }
    } else {
        // ScreenData
        yield* data.title.chunks;
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
        if (chars) subsets.push([i as AnsiCode, CodePointRange.from(chars)]);
    }
    const coverage = CodePointRange.mergeRanges(...subsets.map(([, cp]) => cp));
    return { coverage, subsets };
}

/**
 * Extract all text from the input frame data grouped by ansi style index
 */
export default function extractContentSubsets(data: FrameData): ContentSubsets {
    const ansiChars: [string, string, string, string] = ['', '', '', ''];
    for (const { str, style } of extractChunks(data)) {
        const text = str.replace(/\n/g, '');
        if (text) {
            // [strikeThrough, inverse, underline, italic, dim, bold]
            const ansi = (style.props & 1) | ((style.props >>> 1) & 2);
            ansiChars[ansi] += text;
        }
    }
    return createContentSubsets(ansiChars);
}