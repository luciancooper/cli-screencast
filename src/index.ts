import type { OmitStrict, PickOptional, Dimensions, CaptureData } from './types';
import { resolveTheme, Theme } from './theme';
import parse from './parse';
import readableSpawn, { SpawnOptions } from './spawn';
import captureSource, { CaptureOptions } from './capture';
import TerminalRecordingStream, { SessionOptions, RunCallback } from './terminal';
import { resolveTitle } from './title';
import extractCaptureFrames from './frames';
import { renderScreenSvg, renderCaptureSvg, renderCaptureFrames, RenderOptions, RenderProps } from './render';
import { createPng, createAnimatedPng } from './image';

interface OutputOptions {
    type?: 'svg' | 'png'
    scaleFactor?: number
}

interface BaseOptions extends Dimensions, OutputOptions {
    tabSize?: number
    theme?: Partial<Theme>
}

type BaseDefaults = Required<PickOptional<OmitStrict<BaseOptions, 'theme'>>>;

const baseDefaults: BaseDefaults = {
    tabSize: 8,
    type: 'svg',
    scaleFactor: 4,
};

function applyDefaults<T extends BaseOptions, D>(options: T, defaults: D) {
    const { theme: themeOption, ...other } = options,
        { palette, theme } = resolveTheme(themeOption);
    return {
        ...baseDefaults,
        ...defaults,
        ...other,
        theme,
        palette,
    };
}

export interface RenderScreenOptions extends BaseOptions, RenderOptions {
    cursor?: boolean
    windowTitle?: string | undefined
    windowIcon?: string | boolean | undefined
}

/**
 * Render a terminal screen shot to SVG
 * @param content - screen content to render
 * @param options - render options
 * @returns static screenshot svg
 */
export async function renderScreen(content: string, options: RenderScreenOptions): Promise<string | Buffer> {
    const { type, ...props } = applyDefaults(options, { cursor: false }),
        state = parse(props, {
            lines: [],
            cursor: { line: 0, column: 0 },
            cursorHidden: !props.cursor,
            title: resolveTitle(props.palette, props.windowTitle, props.windowIcon),
        }, content),
        data = renderScreenSvg(state, props);
    return type === 'png' ? createPng(data, props.scaleFactor) : data.svg;
}

async function renderAnimated(
    data: CaptureData,
    props: RenderProps & Required<OutputOptions>,
): Promise<string | Buffer> {
    if (props.type === 'png') {
        const frames = extractCaptureFrames(data),
            svgFrames = renderCaptureFrames(frames, props);
        return createAnimatedPng(svgFrames, props.scaleFactor);
    }
    return renderCaptureSvg(data, props);
}

export interface RenderSpawnOptions extends BaseOptions, RenderOptions, CaptureOptions, SpawnOptions {}

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
    options: RenderSpawnOptions,
): Promise<string | Buffer> {
    const props = applyDefaults(options, {}),
        source = readableSpawn(command, args, props),
        data = await captureSource(source, props);
    return renderAnimated(data, props);
}

export interface RenderCaptureOptions extends BaseOptions, RenderOptions, CaptureOptions, SessionOptions {}

/**
 * Capture any terminal output that occurs within a callback function and render it as an animated SVG.
 * @remarks
 * Within the provided callback function `fn`, all writes to `process.stdout` and `process.stderr`, (and by extension
 * calls to `console.log` and `console.error`) will be captured and included in the returned SVG screencast.
 * @param fn - callback function in which terminal output is captured
 * @param options - render options
 * @returns animated screen capture svg
 */
export async function renderCapture(fn: RunCallback<any>, options: RenderCaptureOptions): Promise<string | Buffer> {
    const props = applyDefaults(options, {}),
        source = new TerminalRecordingStream(props);
    await source.run(fn);
    const data = await captureSource(source, props);
    return renderAnimated(data, props);
}

export type { RGB } from './types';
export type { Theme } from './theme';
export type { RenderOptions, CaptureOptions, SpawnOptions, SessionOptions };