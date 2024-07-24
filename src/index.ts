import type {
    CaptureData, ScreenData, ParsedCaptureData, ParsedScreenData, OutputOptions, TerminalOptions,
} from './types';
import { validateOptions, applyDefTerminalOptions, applyDefOutputOptions, applyDefRenderOptions } from './options';
import { applyLoggingOptions, type LoggingOptions } from './logger';
import { parseScreen, parseCapture } from './parser';
import RecordingStream, { type SourceFrame } from './source';
import { readableSpawn, readableShell, type SpawnOptions, type ShellOptions } from './spawn';
import NodeRecordingStream, { type CallbackOptions, type RunCallback } from './node';
import captureSource, { type CaptureOptions } from './capture';
import extractCaptureFrames from './frames';
import { resolveFonts, embedFontCss, type ResolvedFontData } from './fonts';
import { renderScreenSvg, renderCaptureSvg, renderCaptureFrames, type RenderOptions } from './render';
import { createPng, createAnimatedPng } from './image';
import { dataToJson, dataToYaml, dataFromFile } from './data';
import { writeToFile } from './utils';

interface OutputCache {
    svg?: string
    png?: Buffer
    json?: { data: string, pretty: string }
    yaml?: string
}

async function renderScreenData(screen: ScreenData, options: OutputOptions & RenderOptions) {
    const { outputs, scaleFactor, embedFonts } = applyDefOutputOptions(options),
        props = applyDefRenderOptions(options),
        cache: OutputCache = {};
    let parsed: ParsedScreenData | null = null,
        fonts: ResolvedFontData | null = null,
        output: string | Buffer;
    for (const { type, path } of outputs) {
        if (!cache[type]) {
            if (type === 'json') {
                cache[type] = dataToJson('screen', screen);
            } else if (type === 'yaml') {
                cache[type] = dataToYaml('screen', screen);
            } else {
                parsed ??= parseScreen(screen);
                fonts ??= await resolveFonts(parsed, props.theme.fontFamily);
                const { fontColumnWidth, ...resolvedFonts } = fonts,
                    css = (type === 'png' || embedFonts) ? await embedFontCss(resolvedFonts, type === 'png') : null,
                    rendered = renderScreenSvg(parsed, { ...props, fontColumnWidth, ...css });
                if (type === 'svg') cache[type] = rendered.svg;
                else cache[type] = await createPng(rendered, scaleFactor);
            }
        }
        if (path) await writeToFile(path, type === 'json' ? cache[type]!.pretty : cache[type]!);
        else output = type === 'json' ? cache[type]!.data : cache[type]!;
    }
    return output!;
}

async function renderCaptureData(capture: CaptureData, options: OutputOptions & RenderOptions) {
    const { outputs, scaleFactor, embedFonts } = applyDefOutputOptions(options),
        props = applyDefRenderOptions(options),
        cache: OutputCache = {};
    let parsed: ParsedCaptureData | null = null,
        fonts: ResolvedFontData | null = null,
        output: string | Buffer;
    for (const { type, path } of outputs) {
        if (!cache[type]) {
            if (type === 'json') {
                cache[type] = dataToJson('capture', capture);
            } else if (type === 'yaml') {
                cache[type] = dataToYaml('capture', capture);
            } else {
                parsed ??= parseCapture(capture);
                fonts ??= await resolveFonts(parsed, props.theme.fontFamily);
                const { fontColumnWidth, ...resolvedFonts } = fonts;
                if (type === 'png') {
                    const frames = extractCaptureFrames(parsed),
                        css = await embedFontCss(resolvedFonts, true),
                        svgFrames = renderCaptureFrames(frames, { ...props, fontColumnWidth, ...css });
                    cache[type] = await createAnimatedPng(svgFrames, scaleFactor);
                } else {
                    const css = embedFonts ? await embedFontCss(resolvedFonts) : null;
                    cache[type] = renderCaptureSvg(parsed, { ...props, fontColumnWidth, ...css });
                }
            }
        }
        if (path) await writeToFile(path, type === 'json' ? cache[type]!.pretty : cache[type]!);
        else output = type === 'json' ? cache[type]!.data : cache[type]!;
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
    return renderScreenData({ ...applyDefTerminalOptions(options, { cursorHidden: true }), content }, options);
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
    // create source stream from frames
    const source = RecordingStream.fromFrames(applyDefTerminalOptions(options), frames),
        // capture the source stream
        capture = await captureSource(source, options);
    // render the captured frames
    return renderCaptureData(capture, options);
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
    // launch spawn source stream
    const source = readableSpawn(command, args, options),
        // capture the source stream
        capture = await captureSource(source, options);
    // render the captured source data
    return renderCaptureData(capture, options);
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
    // launch shell source stream
    const source = readableShell(options),
        // capture the source stream
        capture = await captureSource(source, options);
    // render the captured source data
    return renderCaptureData(capture, options);
}

/**
 * Capture any terminal output that occurs within a callback function.
 * @remarks
 * Within the provided callback function `fn`, all writes to `process.stdout` and `process.stderr`, (and by extension
 * calls to `console.log` and `console.error`) will be captured and included in the returned screencast.
 * @param fn - callback function in which terminal output is captured
 * @param options - render options
 * @returns animated screen capture string (if output is svg, json, or yaml) or png buffer
 */
export async function captureCallback(
    fn: RunCallback<any>,
    options: LoggingOptions & OutputOptions & TerminalOptions & CaptureOptions & CallbackOptions & RenderOptions,
): Promise<string | Buffer> {
    // ensure required options are specified
    validateOptions(options);
    // apply log level options
    applyLoggingOptions(options);
    // create a recording stream and run the provided callback function
    const source = new NodeRecordingStream(options);
    await source.run(fn);
    // capture the source stream
    const capture = await captureSource(source, options);
    // render the captured source data
    return renderCaptureData(capture, options);
}

/**
 * Render a screencast or screenshot from a json or yaml data file.
 * @param path - data file containing the screencast data to render
 * @param options - render options
 * @returns rendered screencast svg string or png buffer
 */
export async function renderData(path: string, options: LoggingOptions & OutputOptions & RenderOptions = {}) {
    // apply log level options
    applyLoggingOptions(options);
    // read data from provided source file
    const data = await dataFromFile(path);
    // render the data from the provided file
    return ('writes' in data) ? renderCaptureData(data, options) : renderScreenData(data, options);
}

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
};