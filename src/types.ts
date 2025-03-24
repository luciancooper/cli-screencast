import type icons from './render/icons.json';

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
export type Entry<T> = readonly [key: keyof T, value: T[keyof T]];

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
     * The desired output format, either `svg`, `png`, `json`, or `yaml`.
     * @defaultValue `'svg'`
     */
    output?: OutputType | 'yml'

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

    /**
     * Array of font file paths or urls to resolve fonts from. These fonts will supplement any locally
     * installed system fonts. woff, woff2, and zip files are not supported.
     * @defaultValue `undefined`
     */
    fonts?: string[] | undefined
}

export interface CommandOptions {
    /**
     * Include a command prompt string at the beginning of the rendered capture if a command is present in the capture
     * data. Applies when capturing the output of a child process, or if a `command` string is passed to the `start`
     * method of a `NodeCapture` instance.
     * @defaultValue `true`
     */
    includeCommand?: boolean

    /**
     * The prompt prefix string to use when a command is captured. Only applicable if `includeCommand` is `true`.
     * @defaultValue `'> '`
     */
    prompt?: string

    /**
     * Include a command input keystroke animation at the start of the recording if command prompt line is captured.
     * Only applicable if `includeCommand` is `true`.
     * @defaultValue `true`
     */
    keystrokeAnimation?: boolean

    /**
     * The delay in milliseconds between keystrokes to use when creating a command input animation. Only applicable if
     * `keystrokeAnimation` is `true`.
     * @defaultValue `140`
     */
    keystrokeAnimationInterval?: number
}

export type RGBA = readonly [r: number, g: number, b: number, a?: number];

export interface AnsiStyle {
    /**
     * 6 bit props mask - [strikeThrough, inverse, underline, italic, dim, bold]
     */
    props: number
    /**
     * Foreground color
     */
    fg: number
    /**
     * Background color
     */
    bg: number
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

export interface CaptureData extends Required<TerminalOptions> {
    command: string | undefined
    endDelay: number
    writes: { content: string, delay: number }[]
}

export interface ScreenData extends Required<TerminalOptions> {
    content: string
}

export interface CursorLocation {
    line: number
    column: number
}

export interface CursorState extends CursorLocation {
    visible: boolean
}

export interface TextChunk {
    str: string
    style: AnsiStyle
    x: readonly [idx: number, span: number]
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
    icon: IconID | null
}

export interface TerminalLines {
    lines: TerminalLine[]
}

export interface ParsedFrame extends TerminalLines {
    cursor: CursorLocation | null
    title: Title | null
}

export interface ParsedScreenData extends Dimensions, ParsedFrame {}

export type KeyFrame<T extends {} = {}> = T & { time: number, endTime: number };

export interface ParsedCaptureData extends Dimensions {
    /**
     * Array of key frames for each content frame in the capture, continuous with no gaps
    */
    content: KeyFrame<TerminalLines>[]
    /**
     * Array of key frames for each cursor frame in the capture, continuous with no gaps
    */
    cursor: KeyFrame<CursorState>[]
    /**
     * Array of key frames for each title frame in the capture, can have gaps.
    */
    title: KeyFrame<Title>[]
    duration: number
}

export interface Size {
    width: number
    height: number
}

export type SVGFrameData = Size & ({ frame: string } | { frames: KeyFrame<{ frame: string, memoidx?: number }>[] });