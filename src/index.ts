import type { Readable } from 'stream';
import type { Dimensions, Frame } from './types';
import { applyDefaults, Options, Config } from './options';
import parse from './parse';
import { resolveTitle } from './title';
import RecordingStream from './source';
import readableSpawn, { SpawnOptions } from './spawn';
import TerminalRecordingStream, { SessionOptions, RunCallback } from './terminal';
import captureSource from './capture';
import extractCaptureFrames from './frames';
import { renderScreenSvg, renderCaptureSvg, renderCaptureFrames } from './render';
import { createPng, createAnimatedPng } from './image';

/**
 * Render a terminal screen shot to SVG
 * @param content - screen content to render
 * @param options - render options
 * @returns static screenshot svg
 */
export async function renderScreen(
    content: string,
    options: Dimensions & Options,
): Promise<string | Buffer> {
    const { output, scaleFactor, ...props } = applyDefaults(options, { cursorHidden: true }),
        { cursorHidden, cursor, ...state } = parse(props, {
            lines: [],
            cursor: { line: 0, column: 0 },
            cursorHidden: props.cursorHidden,
            title: resolveTitle(props.palette, props.windowTitle, props.windowIcon),
        }, content),
        data = renderScreenSvg({ ...state, cursor: !cursorHidden ? cursor : null }, props);
    return output === 'png' ? createPng(data, scaleFactor) : data.svg;
}

async function renderSource(
    stream: Readable,
    { output, scaleFactor, ...props }: Config,
) {
    const data = await captureSource(stream, props);
    if (output === 'png') {
        const frames = extractCaptureFrames(data),
            svgFrames = renderCaptureFrames(frames, props);
        return createAnimatedPng(svgFrames, scaleFactor);
    }
    return renderCaptureSvg(data, props);
}

/**
 * Render an animated terminal screen capture from an array of content frames.
 * @param frames - array of content frames
 * @param options - render options
 * @returns animated screen capture svg or png
 */
export async function renderFrames(
    frames: Frame[],
    options: Dimensions & Options,
): Promise<string | Buffer> {
    const props = applyDefaults(options),
        source = RecordingStream.fromFrames(frames);
    return renderSource(source, props);
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
    options: Dimensions & Options & SpawnOptions,
): Promise<string | Buffer> {
    const props = applyDefaults(options),
        source = readableSpawn(command, args, props);
    return renderSource(source, props);
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
export async function renderCapture(
    fn: RunCallback<any>,
    options: Dimensions & Options & SessionOptions,
): Promise<string | Buffer> {
    const props = applyDefaults(options),
        source = new TerminalRecordingStream(props);
    await source.run(fn);
    return renderSource(source, props);
}

export type { RGB } from './types';
export type { Theme } from './theme';
export type { Frame, Options, SpawnOptions, SessionOptions };