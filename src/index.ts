import type { OmitStrict, PickOptional, Dimensions } from './types';
import { resolveTheme, Theme } from './theme';
import parse from './parse';
import { renderScreenSvg, renderCaptureSvg, WindowOptions } from './render';
import readableSpawn, { SpawnOptions } from './spawn';
import captureSource, { CaptureOptions } from './capture';

interface BaseOptions extends Dimensions {
    tabSize?: number
    theme?: Partial<Theme>
}

type BaseDefaults = Required<PickOptional<OmitStrict<BaseOptions, 'theme'>>>;

const baseDefaults: BaseDefaults = {
    tabSize: 8,
};

function applyDefaults<T extends BaseOptions, D>(options: T, defaults?: D) {
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

export interface RenderScreenOptions extends BaseOptions, WindowOptions {
    cursor?: boolean
}

/**
 * Render a terminal screen shot to SVG
 * @param content - screen content to render
 * @param options - render options
 * @returns static screenshot svg
 */
export function renderScreen(content: string, options: RenderScreenOptions): string {
    const { cursor, ...props } = applyDefaults(options, { cursor: false }),
        state = parse(props, { lines: [], cursor: { line: 0, column: 0, hidden: !cursor } }, content);
    return renderScreenSvg(state, props);
}

export type RenderSpawnOptions = BaseOptions & WindowOptions & CaptureOptions & SpawnOptions;

/**
 * Record the terminal output of a command and render it as an animated SVG
 * @param command - the command to run
 * @param args - list of string arguments
 * @param options - render options
 * @returns animated screen capture svg
 */
export async function renderSpawn(command: string, args: string[], options: RenderSpawnOptions): Promise<string> {
    const props = applyDefaults(options),
        source = readableSpawn(command, args, props),
        data = await captureSource(source, props);
    return renderCaptureSvg(data, props);
}

export type { RGB } from './types';
export type { Theme } from './theme';
export type { WindowOptions, CaptureOptions, SpawnOptions };