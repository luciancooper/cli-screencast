import type { Dimensions, Palette, TerminalOptions, OutputOptions } from './types';
import type { CaptureOptions } from './capture';
import type { RenderOptions } from './render';
import { resolveTheme, Theme } from './theme';

type CoreOptions = TerminalOptions & OutputOptions & RenderOptions & CaptureOptions;

export interface Options extends CoreOptions {
    theme?: Partial<Theme>
}

export interface Config extends Dimensions, Required<CoreOptions> {
    theme: Theme<string>
    palette: Palette
}

export const defaults: Required<CoreOptions> = {
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
        { palette, theme } = resolveTheme(themeOption),
        spec = { ...defaults, ...(extraDefaults ?? {}), ...other };
    return { ...spec, theme, palette };
}