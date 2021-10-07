import icons from './render/icons.json';

/**
 * A strict version of the built-in `Omit` that requires omitted keys `K` to be present on the given type `T`.
 */
export type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * A recursive version of the built-in `Partial` type that makes all keys and nested keys optional.
 */
export type DeepPartial<T> = T extends (...args: any[]) => any ? T
    : T extends readonly (infer E)[] ? (E extends Record<string, any> ? DeepPartial<E>[] : T)
        : T extends Record<string, any> ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/**
 * Get the optional keys of type `T`
 */
export type OptionalKeys<T> = { [K in keyof T]-?: undefined extends { [P in keyof T]: P }[K] ? K : never; }[keyof T];

/**
 * Create a type from all the optional keys of `T`.
 */
export type PickOptional<T> = Pick<T, OptionalKeys<T>>;

/**
 * Create a type that represents the type of an objects `[key, value]` entry pairs.
 */
export type Entry<T> = readonly [keyof T, T[keyof T]];

/**
 * Create a type that represents an array of an objects `[key, value]` entry pairs.
 */
export type Entries<T> = Entry<T>[];

export type RGB = readonly [number, number, number];

export interface Palette<T = string> {
    [K: number]: T
    readonly length: 16
    [Symbol.iterator]: () => IterableIterator<T>
}

export interface AnsiStyle {
    /**
     * 6 bit props mask - [strikeThrough, inverse, underline, italic, dim, bold]
     */
    readonly props: number
    /**
     * Foreground color
     */
    readonly fg?: string
    /**
     * Background color
     */
    readonly bg?: string
    /**
     * Hyperlink
     */
    readonly link?: string
}

export interface AnsiStyleProps {
    bold: boolean
    dim: boolean
    italic: boolean
    underline: boolean
    inverted: boolean
    strikeThrough: boolean
}

export interface Dimensions {
    columns: number
    rows: number
}

export interface CursorLocation {
    line: number
    column: number
    hidden: boolean
}

export interface TextChunk {
    str: string
    style: AnsiStyle
    x: readonly [number, number]
}

export interface TerminalLine {
    index: number
    columns: number
    chunks: TextChunk[]
}

export type IconID = keyof typeof icons;

export interface Title {
    icon: IconID | undefined
    text: string | undefined
    columns: number
    chunks: TextChunk[]
}

export interface ScreenData {
    lines: TerminalLine[]
    cursor: CursorLocation
    title: Title
}

export interface RecordingFrame {
    time: number
    endTime: number
}

export interface ContentRecordingFrame extends RecordingFrame {
    lines: TerminalLine[]
}

export interface CursorRecordingFrame extends CursorLocation, RecordingFrame {}

export interface TitleRecordingFrame extends Title, RecordingFrame {}

export interface CaptureData {
    content: ContentRecordingFrame[]
    cursor: CursorRecordingFrame[]
    title: TitleRecordingFrame[]
    duration: number
}

export interface CaptureFrame extends RecordingFrame {
    screen: ScreenData
}

export interface Size {
    width: number
    height: number
}

export interface SVGData extends Size {
    svg: string
}

export interface SVGDataFrame extends RecordingFrame {
    svg: string
}

export interface SVGCaptureData extends Size {
    frames: SVGDataFrame[]
}