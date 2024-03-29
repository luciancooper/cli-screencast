import type { LogLevel } from './logger';
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
 * Get the optional keys of type `T` (all keys defined like `{ k?: v }`)
 */
export type OptionalKeys<T> = { [K in keyof T]-?: undefined extends { [P in keyof T]: P }[K] ? K : never; }[keyof T];

/**
 * Adds `undefined` to all properties of `T` defined with the `?` prefix.
 * For cases where you want to ignore the stricter rules `exactOptionalPropertyTypes` applies to object types.
 */
export type Optionalize<T> = { [K in keyof T]: undefined extends { [P in keyof T]: P }[K] ? T[K] | undefined : T[K] };

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

export interface BaseOptions {
    /**
     * Control how much info is logged to the console during the render process
     * Options are (in order of decending verbosity): 'debug', 'info', 'warn', 'error', and 'silent'
     * @defaultValue 'info'
     */
    logLevel?: LogLevel
}

export interface TerminalOptions {
    /**
     * Tab column width
     * @defaultValue `8`
     */
    tabSize?: number

    /**
     * Default cursor visibility. When capturing an animated screen recording, this will be the cursors
     * visibility at the start of the capture. When rendering a screen shot, this will be
     * the cursor visibility for the rendered frame.
     * @defaultValue `false`
     */
    cursorHidden?: boolean

    /**
     * Default terminal window title. When rendering a captured screen cast recording, this will be the window title
     * at the start of the capture. When rendering a screen shot, this will be the window title for the rendered frame.
     * @defaultValue `undefined`
     */
    windowTitle?: string | undefined

    /**
     * Default terminal window icon. When rendering a captured screen cast recording, this will be the window icon
     * at the start of the capture. When rendering a screen shot, this will be the window icon for the rendered frame.
     * @defaultValue `undefined`
     */
    windowIcon?: string | boolean | undefined
}

export interface OutputOptions {
    /**
     * The desired output format, either `svg` or `png`.
     * @defaultValue `'svg'`
     */
    output?: 'svg' | 'png'

    /**
     * the device scale factor used when rendering to png, only applicable when `output` is `'png'`.
     * @defaultValue `4`
     */
    scaleFactor?: number

    /**
     * Embed required fonts when rendering to svg, only applicable when `output` is `'svg'`.
     * @defaultValue `true`
     */
    embedFonts?: boolean
}

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
    readonly fg?: string | undefined
    /**
     * Background color
     */
    readonly bg?: string | undefined
    /**
     * Hyperlink
     */
    readonly link?: string | undefined
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

export interface TerminalLines {
    lines: TerminalLine[]
}

export interface TerminalState extends TerminalLines {
    title: Title
    cursor: CursorLocation
    cursorHidden: boolean
}

export interface ScreenData extends TerminalLines {
    cursor: CursorLocation | null
    title: Title
}

export interface Frame {
    content: string
    duration: number
}

export interface KeyFrame {
    time: number
    endTime: number
}

export interface ContentKeyFrame extends KeyFrame, TerminalLines {}

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