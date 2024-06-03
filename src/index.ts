import type { CaptureData, OutputOptions, OutputType, TerminalOptions } from './types';
import { applyDefTerminalOptions, applyDefOutputOptions, applyDefRenderOptions } from './options';
import { applyLoggingOptions, type LoggingOptions } from './logger';
import { parseScreen, parseCapture } from './parser';
import RecordingStream, { type SourceFrame } from './source';
import readableSpawn, { type SpawnOptions } from './spawn';
import NodeRecordingStream, { type CallbackOptions, type RunCallback } from './node';
import captureSource, { type CaptureOptions } from './capture';
import extractScreenCastFrames from './frames';
import createFontCss from './fonts';
import { renderScreenSvg, renderCaptureSvg, renderCaptureFrames, type RenderOptions } from './render';
import { createPng, createAnimatedPng } from './image';
import { writeToFile } from './utils';

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
    const { outputs, scaleFactor, embedFonts } = applyDefOutputOptions(options),
        screenData = parseScreen(content, applyDefTerminalOptions(options, { cursorHidden: true })),
        props = applyDefRenderOptions(options),
        cache: Partial<Record<OutputType, string | Buffer>> = {};
    let output: string | Buffer;
    for (const { type, path } of outputs) {
        if (cache[type]) {
            await writeToFile(path!, cache[type]!);
            continue;
        }
        const font = (type === 'png' || embedFonts)
                ? await createFontCss(screenData, props.theme.fontFamily) : null,
            rendered = renderScreenSvg(screenData, { ...props, ...font });
        cache[type] = type === 'png' ? await createPng(rendered, scaleFactor) : rendered.svg;
        if (path) await writeToFile(path, cache[type]!);
        else output = cache[type]!;
    }
    return output!;
}

async function renderCapture(capture: CaptureData, options: OutputOptions & RenderOptions) {
    const data = parseCapture(capture),
        { outputs, scaleFactor, embedFonts } = applyDefOutputOptions(options),
        props = applyDefRenderOptions(options),
        cache: Partial<Record<OutputType, string | Buffer>> = {};
    let output: string | Buffer;
    for (const { type, path } of outputs) {
        if (cache[type]) {
            await writeToFile(path!, cache[type]!);
            continue;
        }
        if (type === 'png') {
            const frames = extractScreenCastFrames(data),
                svgFrames = renderCaptureFrames(frames, {
                    ...props,
                    ...await createFontCss(frames, props.theme.fontFamily),
                });
            cache[type] = await createAnimatedPng(svgFrames, scaleFactor);
        } else {
            cache[type] = renderCaptureSvg(data, {
                ...props,
                ...(embedFonts ? await createFontCss(data, props.theme.fontFamily) : null),
            });
        }
        if (path) await writeToFile(path, cache[type]!);
        else output = cache[type]!;
    }
    return output!;
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
    return renderCapture(capture, options);
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
    return renderCapture(capture, options);
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
    return renderCapture(capture, options);
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