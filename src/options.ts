import type { Dimensions, BaseOptions, TerminalOptions, OutputOptions } from './types';
import type { CaptureOptions } from './capture';
import type { RenderOptions } from './render';
import { resolveTheme, type Theme } from './theme';
import { setLogLevel } from './logger';

type CoreOptions = TerminalOptions & OutputOptions & RenderOptions & CaptureOptions;

export interface Options extends BaseOptions, CoreOptions {
    theme?: Partial<Theme>
}

export interface Config extends Dimensions, Required<CoreOptions> {
    theme: Theme<string>
}

export const defaults: Required<BaseOptions & CoreOptions> = {
    // BaseOptions
    logLevel: 'info',
    // TerminalOptions
    tabSize: 8,
    cursorHidden: false,
    windowTitle: undefined,
    windowIcon: undefined,
    // OutputOptions
    output: 'svg',
    scaleFactor: 4,
    embedFonts: true,
    // CaptureOptions
    writeMergeThreshold: 80,
    endTimePadding: 500,
    cropStartDelay: true,
    captureCommand: true,
    prompt: '> ',
    keystrokeAnimation: true,
    keystrokeAnimationInterval: 100,
    // RenderOptions
    fontSize: 16,
    lineHeight: 1.25,
    columnWidth: undefined,
    iconColumnWidth: 1.6,
    borderRadius: 5,
    decorations: true,
    insetMajor: 40,
    insetMinor: 20,
    paddingY: 5,
    paddingX: 5,
};

export function applyDefaults<T extends Options, D>(options: T, extraDefaults?: D) {
    const { theme: themeOption, ...other } = options,
        theme = resolveTheme(themeOption),
        { logLevel, ...spec } = { ...defaults, ...(extraDefaults ?? {}), ...other };
    // set package wide log level
    setLogLevel(logLevel);
    return { ...spec, theme };
}