import type {
    CaptureData, ScreenData, ParsedCaptureData, ParsedScreenData, OutputOptions, TerminalOptions,
} from './types';
import { validateOptions, applyDefTerminalOptions, applyDefOutputOptions, applyDefRenderOptions } from './options';
import log, { applyLoggingOptions, setLogLevel, resetLogLevel, type LoggingOptions } from './logger';
import { parseScreen, parseCapture } from './parser';
import { readableFrames, type SourceFrame } from './source';
import { readableSpawn, readableShell, type SpawnOptions, type ShellOptions } from './spawn';
import readableCallback, { type CallbackOptions, type NodeCapture } from './node';
import captureSource, { type CaptureOptions } from './capture';
import { resolveFonts, embedFontCss, type ResolvedFontData, type EmbeddedFontData } from './fonts';
import { renderScreenSvg, renderScreenFrames, renderCaptureSvg, renderCaptureFrames, type RenderOptions } from './render';
import { createPng } from './image';
import { dataToJson, dataToYaml, dataFromFile } from './data';
import { writeToFile } from './utils';

interface OutputCache {
    svg?: string
    png?: Buffer
    json?: { data: string, pretty: string }
    yaml?: string
}

async function renderScreenData(screen: ScreenData, options: OutputOptions & RenderOptions) {
    const { outputs, ...outputProps } = applyDefOutputOptions(options),
        props = applyDefRenderOptions(options),
        cache: OutputCache = {};
    let parsed: ParsedScreenData | null = null,
        fonts: ResolvedFontData | null = null,
        cssData: EmbeddedFontData | null = null,
        output: string | Buffer;
    for (const { type, path } of outputs) {
        if (!cache[type]) {
            if (type === 'json') {
                cache[type] = dataToJson('screen', screen);
            } else if (type === 'yaml') {
                cache[type] = dataToYaml('screen', screen);
            } else {
                parsed ??= parseScreen(screen);
                fonts ??= await resolveFonts(parsed, props.fontFamily, outputProps.fonts);
                const { fontColumnWidth, ...resolvedFonts } = fonts;
                cssData ??= await embedFontCss(resolvedFonts, {
                    png: outputs.some(({ type: t }) => t === 'png'),
                    svg: outputProps.embedFonts && outputs.some(({ type: t }) => t === 'svg'),
                });
                const { [type]: css, fontFamily } = cssData,
                    fontProps = { fontColumnWidth, css, fontFamily };
                if (type === 'png') {
                    const frames = renderScreenFrames(parsed, { ...props, ...fontProps });
                    cache[type] = await createPng(frames, outputProps.scaleFactor);
                } else {
                    cache[type] = renderScreenSvg(parsed, { ...props, ...fontProps });
                }
            }
        }
        if (path) {
            await writeToFile(path, type === 'json' ? cache[type]!.pretty : cache[type]!);
            log.info('wrote %s data out to file %p', type, path);
        } else output = type === 'json' ? cache[type]!.data : cache[type]!;
    }
    return output!;
}

async function renderCaptureData(capture: CaptureData, options: OutputOptions & RenderOptions) {
    const { outputs, ...ouputProps } = applyDefOutputOptions(options),
        props = applyDefRenderOptions(options),
        cache: OutputCache = {};
    let parsed: ParsedCaptureData | null = null,
        fonts: ResolvedFontData | null = null,
        cssData: EmbeddedFontData | null = null,
        output: string | Buffer;
    for (const { type, path } of outputs) {
        if (!cache[type]) {
            if (type === 'json') {
                cache[type] = dataToJson('capture', capture);
            } else if (type === 'yaml') {
                cache[type] = dataToYaml('capture', capture);
            } else {
                parsed ??= parseCapture(capture);
                fonts ??= await resolveFonts(parsed, props.fontFamily, ouputProps.fonts);
                const { fontColumnWidth, ...resolvedFonts } = fonts;
                cssData ??= await embedFontCss(resolvedFonts, {
                    png: outputs.some(({ type: t }) => t === 'png'),
                    svg: ouputProps.embedFonts && outputs.some(({ type: t }) => t === 'svg'),
                });
                const { [type]: css, fontFamily } = cssData,
                    fontProps = { fontColumnWidth, css, fontFamily };
                if (type === 'png') {
                    const frames = renderCaptureFrames(parsed, { ...props, ...fontProps });
                    cache[type] = await createPng(frames, ouputProps.scaleFactor);
                } else {
                    cache[type] = renderCaptureSvg(parsed, { ...props, ...fontProps });
                }
            }
        }
        if (path) {
            await writeToFile(path, type === 'json' ? cache[type]!.pretty : cache[type]!);
            log.info('wrote %s data out to file %p', type, path);
        } else output = type === 'json' ? cache[type]!.data : cache[type]!;
    }
    return output!;
}

/**
 * Render a terminal screenshot to svg or png, or to a data storage format (json or yaml)
 * @param content - screen content to render
 * @param options - render options
 * @returns screenshot string (if output is svg, json, or yaml) or png buffer
 */
export async function renderScreen(
    content: string,
    options: LoggingOptions & TerminalOptions & OutputOptions & RenderOptions,
): Promise<string | Buffer> {
    // ensure required options are specified
    validateOptions(options);
    // apply log level options
    applyLoggingOptions(options);
    // render screenshot
    try {
        return await renderScreenData(
            { ...applyDefTerminalOptions(options, { cursorHidden: true }), content },
            options,
        );
    } finally {
        resetLogLevel();
    }
}

/**
 * Create an animated terminal screen capture from an array of content frames.
 * @param frames - array of content frames
 * @param options - render options
 * @returns animated screen capture string (if output is svg, json, or yaml) or png buffer
 */
export async function captureFrames(
    frames: SourceFrame[],
    options: LoggingOptions & OutputOptions & TerminalOptions & CaptureOptions & RenderOptions,
): Promise<string | Buffer> {
    // ensure required options are specified
    validateOptions(options);
    // apply log level options
    applyLoggingOptions(options);
    try {
        const ac = new AbortController(),
            // create source stream from frames
            source = readableFrames(options, frames, ac),
            // capture the source stream
            capture = await captureSource(source, options, ac);
        // render the captured frames
        return await renderCaptureData(capture, options);
    } finally {
        resetLogLevel();
    }
}

/**
 * Capture the terminal output of a spawned command
 * @param command - the command to run
 * @param args - list of string arguments
 * @param options - render options
 * @returns animated screen capture string (if output is svg, json, or yaml) or png buffer
 */
export async function captureSpawn(
    command: string,
    args: string[],
    options: LoggingOptions & OutputOptions & TerminalOptions & CaptureOptions & SpawnOptions & RenderOptions,
): Promise<string | Buffer> {
    // ensure required options are specified
    validateOptions(options);
    // apply log level options
    applyLoggingOptions(options);
    try {
        const ac = new AbortController(),
            // launch spawn source stream
            source = readableSpawn(command, args, options, ac),
            // capture the source stream
            capture = await captureSource(source, options, ac);
        // render the captured source data
        return await renderCaptureData(capture, options);
    } finally {
        resetLogLevel();
    }
}

/**
 * Capture a pty shell session. A new shell session will be spawned and piped to `process.stdout` and `process.stdin`.
 * The shell session recording can be stopped with `Ctrl+D`.
 * @param options - options spec
 * @returns animated screen capture string (if output is svg, json, or yaml) or png buffer
 */
export async function captureShell(
    options: LoggingOptions & OutputOptions & TerminalOptions & CaptureOptions & ShellOptions & RenderOptions,
): Promise<string | Buffer> {
    // ensure required options are specified
    validateOptions(options);
    // apply log level options
    applyLoggingOptions(options);
    try {
        const ac = new AbortController(),
            // launch shell source stream
            source = readableShell(options, ac),
            // capture the source stream
            capture = await captureSource(source, options, ac);
        // render the captured source data
        return await renderCaptureData(capture, options);
    } finally {
        resetLogLevel();
    }
}

/**
 * Capture any terminal output that occurs within a callback function.
 * @remarks
 * Within the provided callback function `fn`, all writes to `process.stdout` and `process.stderr`, (and by extension
 * calls to `console.log` and `console.error`) will be captured and included in the returned screencast.
 * @param fn - callback function in which terminal output is captured. Can be synchronous or asynchronous.
 * @param options - render options
 * @returns animated screen capture string (if output is svg, json, or yaml) or png buffer
 */
export async function captureCallback(
    fn: (capture: NodeCapture) => any,
    options: LoggingOptions & OutputOptions & TerminalOptions & CaptureOptions & CallbackOptions & RenderOptions,
): Promise<string | Buffer> {
    // ensure required options are specified
    validateOptions(options);
    // apply log level options
    applyLoggingOptions(options);
    try {
        const ac = new AbortController(),
            // create a callback recording stream
            source = readableCallback(fn, options, ac),
            // capture the source stream
            capture = await captureSource(source, options, ac);
        // render the captured source data
        return await renderCaptureData(capture, options);
    } finally {
        resetLogLevel();
    }
}

/**
 * Render a screencast or screenshot from a json or yaml data file.
 * @param path - data file path containing the screencast data to render
 * @param options - render options
 * @returns rendered screencast svg string or png buffer
 */
export async function renderData(path: string, options: LoggingOptions & OutputOptions & RenderOptions = {}) {
    // apply log level options
    applyLoggingOptions(options);
    try {
        // read data from provided source file
        const { type, data } = await dataFromFile(path);
        // render the data from the provided file
        return await (type === 'capture' ? renderCaptureData(data, options) : renderScreenData(data, options));
    } finally {
        resetLogLevel();
    }
}

export { setLogLevel };

export type { RGBA } from './types';
export type { Theme } from './theme';

export type {
    SourceFrame,
    LoggingOptions,
    OutputOptions,
    TerminalOptions,
    CaptureOptions,
    RenderOptions,
    SpawnOptions,
    CallbackOptions,
    NodeCapture,
};