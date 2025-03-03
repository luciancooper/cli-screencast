import { stringWidth } from 'tty-strings';
import type {
    AnsiStyle, AnsiStyleProps, CursorLocation, CursorState, KeyFrame, TextChunk, TextLine,
} from '@src/types';
import { encodeColor } from '@src/color';

type RGB = readonly [r: number, g: number, b: number];

export type StylePartial = Partial<AnsiStyleProps> & {
    fg?: number | RGB
    bg?: number | RGB
    link?: string | undefined
};

export function makeStyle({
    fg,
    bg,
    bold,
    dim,
    italic,
    underline,
    inverted,
    strikeThrough,
    ...style
}: StylePartial = {}): AnsiStyle {
    return {
        props: [bold, dim, italic, underline, inverted, strikeThrough]
            .map((b, i) => Number(b ?? false) << i)
            .reduce((a, b) => a | b),
        fg: typeof fg === 'number' ? encodeColor(fg) : fg ? encodeColor(...fg) : 0,
        bg: typeof bg === 'number' ? encodeColor(bg) : bg ? encodeColor(...bg) : 0,
        ...style,
    };
}

export function makeCursor(line: number, column: number): CursorLocation;
export function makeCursor(line: number, column: number, visible: boolean): CursorState;
export function makeCursor(line: number, column: number, visible?: boolean): CursorLocation | CursorState {
    return visible === undefined ? { line, column } : { line, column, visible };
}

export function makeKeyFrames<T extends {}>(spans: [ms: number, data: T | null][]): KeyFrame<T>[];
export function makeKeyFrames<T extends {}>(spans: [ms: number, data: T | null][], dur: true): [KeyFrame<T>[], number];
export function makeKeyFrames<T extends {}>(spans: [ms: number, data: T | null][], dur?: true) {
    const [frames, duration] = spans.reduce<[KeyFrame<T>[], number]>(([acc, time], [ms, data]) => {
        if (data !== null) acc.push({ time, endTime: time + ms, ...data });
        return [acc, time + ms];
    }, [[], 0]);
    return dur ? [frames, duration] : frames;
}

type CursorFrameSpan = [ms: number, visible?: number, line?: number, col?: number][];

export function makeCursorFrames(testFrames: CursorFrameSpan): KeyFrame<CursorState>[];
export function makeCursorFrames(testFrames: CursorFrameSpan, dur: true): [KeyFrame<CursorState>[], number];
export function makeCursorFrames(testFrames: CursorFrameSpan, dur?: true) {
    const [frames, duration] = testFrames.reduce<[KeyFrame<CursorState>[], number, CursorState]>(
        ([acc, time, last], [ms, vis, line, col]) => {
            const next = makeCursor(
                line ?? last.line,
                col ?? last.column,
                vis === undefined ? last.visible : Boolean(vis),
            );
            acc.push({ time, endTime: time + ms, ...next });
            return [acc, time + ms, next];
        },
        [[], 0, { line: 0, column: 0, visible: true }],
    );
    return dur ? [frames, duration] : frames;
}

export function makeLine(...args: (string | number | undefined | [string, StylePartial])[]): TextLine {
    let x = 0;
    const chunks: TextChunk[] = [];
    for (const arg of args) {
        if (arg == null) continue;
        if (typeof arg !== 'number') {
            let style: StylePartial = {},
                str: string;
            if (typeof arg === 'string') str = arg;
            else [str, style] = arg;
            const span = stringWidth(str);
            chunks.push({ str, style: makeStyle(style), x: [x, span] });
            x += span;
        } else x += arg;
    }
    return { columns: x, chunks };
}