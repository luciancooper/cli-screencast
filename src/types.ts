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
}

export interface TextChunk {
    str: string
    style: AnsiStyle
    x: readonly [number, number]
}

export interface TextLine {
    columns: number
    chunks: TextChunk[]
}

export interface TerminalLine extends TextLine {
    index: number
}

export type IconID = keyof typeof icons;

export interface Title extends TextLine {
    icon: IconID | undefined
    text: string | undefined
}

export interface TerminalState {
    title: Title
    lines: TerminalLine[]
    cursor: CursorLocation
    cursorHidden: boolean
}

export interface ScreenData {
    lines: TerminalLine[]
    cursor: CursorLocation | null
    title: Title
}

export interface KeyFrame {
    time: number
    endTime: number
}

export interface ContentKeyFrame extends KeyFrame {
    lines: TerminalLine[]
}

export interface CursorKeyFrame extends KeyFrame, CursorLocation {}

export interface TitleKeyFrame extends KeyFrame, Title {}

export interface CaptureData {
    content: ContentKeyFrame[]
    cursor: CursorKeyFrame[]
    title: TitleKeyFrame[]
    duration: number
}

export interface CaptureKeyFrame extends KeyFrame, ScreenData {}

export interface Size {
    width: number
    height: number
}

export interface SVGData extends Size {
    svg: string
}

export interface SVGKeyFrame extends KeyFrame {
    svg: string
}

export interface SVGCaptureData extends Size {
    frames: SVGKeyFrame[]
}