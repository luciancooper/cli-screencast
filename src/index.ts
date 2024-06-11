import type {
    CaptureData, ScreenData, ParsedCaptureData, ParsedScreenData, OutputOptions, TerminalOptions,
} from './types';
import { applyDefTerminalOptions, applyDefOutputOptions, applyDefRenderOptions } from './options';
import { applyLoggingOptions, type LoggingOptions } from './logger';
import { parseScreen, parseCapture } from './parser';
import RecordingStream, { type SourceFrame } from './source';
import readableSpawn, { type SpawnOptions } from './spawn';
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
                const { fontFamilies, fontColumnWidth } = fonts,
                    css = (type === 'png' || embedFonts) ? await embedFontCss(fontFamilies, type === 'png') : null,
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
                const { fontFamilies, fontColumnWidth } = fonts;
                if (type === 'png') {
                    const frames = extractCaptureFrames(parsed),
                        css = await embedFontCss(fontFamilies, true),
                        svgFrames = renderCaptureFrames(frames, { ...props, fontColumnWidth, ...css });
                    cache[type] = await createAnimatedPng(svgFrames, scaleFactor);
                } else {
                    const css = embedFonts ? await embedFontCss(fontFamilies) : null;
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
 * Render a terminal screen shot to SVG
 * @param content - screen content to render
 * @param options - render options
 * @returns static screenshot svg
 */
export async function renderScreen(
    content: string,
    options: LoggingOptions & TerminalOptions & OutputOptions & RenderOptions,
): Promise<string | Buffer> {
    applyLoggingOptions(options);
    return renderScreenData({ ...applyDefTerminalOptions(options, { cursorHidden: true }), content }, options);
}

/**
 * Render an animated terminal screen capture from an array of content frames.
 * @param frames - array of content frames
 * @param options - render options
 * @returns animated screen capture svg or png
 */
export async function renderFrames(
    frames: SourceFrame[],
    options: LoggingOptions & OutputOptions & TerminalOptions & CaptureOptions & RenderOptions,
): Promise<string | Buffer> {
    applyLoggingOptions(options);
    const source = RecordingStream.fromFrames(applyDefTerminalOptions(options), frames),
        capture = await captureSource(source, options);
    return renderCaptureData(capture, options);
}

/**
 * Record the terminal output of a command and render it as an animated SVG
 * @param command - the command to run
 * @param args - list of string arguments
 * @param options - render options
 * @returns animated screen capture svg
 */
export async function renderSpawn(
    command: string,
    args: string[],
    options: LoggingOptions & OutputOptions & TerminalOptions & CaptureOptions & SpawnOptions & RenderOptions,
): Promise<string | Buffer> {
    applyLoggingOptions(options);
    const source = readableSpawn(command, args, options),
        capture = await captureSource(source, options);
    return renderCaptureData(capture, options);
}

/**
 * Capture any terminal output that occurs within a callback function and render it as an animated SVG.
 * @remarks
 * Within the provided callback function `fn`, all writes to `process.stdout` and `process.stderr`, (and by extension
 * calls to `console.log` and `console.error`) will be captured and included in the returned SVG screencast.
 * @param fn - callback function in which terminal output is captured
 * @param options - render options
 * @returns animated screen capture svg
 */
export async function renderCallback(
    fn: RunCallback<any>,
    options: LoggingOptions & OutputOptions & TerminalOptions & CaptureOptions & CallbackOptions & RenderOptions,
): Promise<string | Buffer> {
    applyLoggingOptions(options);
    const source = new NodeRecordingStream(options);
    await source.run(fn);
    const capture = await captureSource(source, options);
    return renderCaptureData(capture, options);
}

/**
 * Render a screencast or screenshot from a json or yaml data file.
 * @param path - data file containing the screencast data to render
 * @param options - render options
 * @returns rendered screencast svg string or png buffer
 */
export async function renderData(path: string, options: LoggingOptions & OutputOptions & RenderOptions = {}) {
    applyLoggingOptions(options);
    const data = await dataFromFile(path);
    return ('writes' in data) ? renderCaptureData(data, options) : renderScreenData(data, options);
}

export type { RGB } from './types';
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