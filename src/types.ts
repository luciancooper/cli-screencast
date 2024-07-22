import icons from './render/icons.json';

/**
 * A strict version of the built-in `Omit` that requires omitted keys `K` to be present on the given type `T`.
 */
export type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * A recursive version of the built-in `Partial` type that makes all keys and nested keys optional.
 */
export type DeepPartial<T> = T extends (...args: any[]) => any ? T
    : T extends readonly (infer E)[]
        ? T extends (T extends readonly any[] ? (any[] extends T ? never : T) : never)
            ? { [K in keyof T]: DeepPartial<T[K]> }
            : T extends E[]
                ? (DeepPartial<E> | undefined)[]
                : readonly (DeepPartial<E> | undefined)[]
        : T extends Record<string, any> ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/**
 * Make all properties in `T` optional except for keys `K`
 */
export type PartialExcept<T, K extends keyof T> = Pick<T, K> & Partial<Pick<T, Exclude<keyof T, K>>>;

/**
 * Adds `undefined` to all properties of `T` defined with the `?` prefix.
 * For cases where you want to ignore the stricter rules `exactOptionalPropertyTypes` applies to object types.
 */
export type Optionalize<T> = { [K in keyof T]: undefined extends { [P in keyof T]: P }[K] ? T[K] | undefined : T[K] };

/**
 * Create a type from all the optional keys of `T`.
 */
export type PickOptional<T> = { [K in keyof T as {} extends Pick<T, K> ? K : never]: T[K]; };

/**
 * Create a type that represents the type of an objects `[key, value]` entry pairs.
 */
export type Entry<T> = readonly [keyof T, T[keyof T]];

/**
 * Create a type that represents an array of an objects `[key, value]` entry pairs.
 */
export type Entries<T> = Entry<T>[];

export interface Dimensions {
    columns: number
    rows: number
}

export interface TerminalOptions extends Dimensions {
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

export type OutputType = 'svg' | 'png' | 'json' | 'yaml';

export interface OutputOptions {
    /**
     * The desired output format, either `svg` or `png`.
     * @defaultValue `'svg'`
     */
    output?: OutputType

    /**
     * File path or array of file paths to write output to. The type of output will be inferred by the
     * file extension (can be either svg or png).
     * @defaultValue `undefined`
     */
    outputPath?: string | string[] | undefined

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

export type RGBA = readonly [number, number, number, number?];

export interface AnsiStyle {
    /**
     * 6 bit props mask - [strikeThrough, inverse, underline, italic, dim, bold]
     */
    props: number
    /**
     * Foreground color
     */
    fg?: number | RGBA | undefined
    /**
     * Background color
     */
    bg?: number | RGBA | undefined
    /**
     * Hyperlink
     */
    link?: string | undefined
}

export interface AnsiStyleProps {
    bold: boolean
    dim: boolean
    italic: boolean
    underline: boolean
    inverted: boolean
    strikeThrough: boolean
}

export interface CaptureData extends Dimensions {
    tabSize: number
    endDelay: number
    writes: { content: string, delay: number }[]
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

export interface ScreenData extends Required<TerminalOptions> {
    content: string
}

export interface ParsedScreenData extends Dimensions, TerminalLines {
    cursor: CursorLocation | null
    title: Title
}

export interface KeyFrame {
    time: number
    endTime: number
}

export interface ContentKeyFrame extends KeyFrame, TerminalLines {}

export interface CursorKeyFrame extends KeyFrame, CursorLocation {}

export interface TitleKeyFrame extends KeyFrame, Title {}

export interface ParsedCaptureData extends Dimensions {
    content: ContentKeyFrame[]
    cursor: CursorKeyFrame[]
    title: TitleKeyFrame[]
    duration: number
}

export interface CaptureKeyFrame extends KeyFrame, TerminalLines {
    cursor: CursorLocation | null
    title: Title
}

export interface ParsedCaptureFrames extends Dimensions {
    frames: CaptureKeyFrame[]
}

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