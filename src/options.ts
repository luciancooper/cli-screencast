import type { PickOptional, OmitStrict, Dimensions, OutputOptions, OutputType, TerminalOptions } from './types';
import type { RenderOptions, BoxShadowOptions } from './render';
import { resolveTheme } from './theme';
import { resolveFilePath } from './utils';
import log from './logger';

export function validateOptions<T extends Dimensions>(options: T) {
    if (typeof options.columns !== 'number' || typeof options.rows !== 'number') {
        throw new Error("Invalid options spec, 'columns' and 'rows' options must be provided");
    }
}

export function applyDefaults<D extends {}, O extends Partial<D> = Partial<D>>(def: D, options: O): D {
    return {
        ...def,
        ...(Object.keys(def) as (keyof O)[]).reduce<O>((acc, key) => {
            if (Object.hasOwn(options, key)) acc[key] = options[key];
            return acc;
        // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
        }, {} as O),
    };
}

const defaultOutputOptions: Required<OutputOptions> = {
    output: 'svg',
    outputPath: undefined,
    scaleFactor: 4,
    embedFonts: true,
    fonts: undefined,
};

export function applyDefOutputOptions(options: OutputOptions) {
    const { output, outputPath, ...spec } = applyDefaults(defaultOutputOptions, options),
        // create array of output specs
        outputs: { type: OutputType, path: string | null }[] = [{ type: output, path: null }];
    if (outputPath) {
        // create output spec for each specified output path
        for (const file of (typeof outputPath === 'string' ? [outputPath] : outputPath)) {
            const { path, ext } = resolveFilePath(file);
            if (['svg', 'png', 'json', 'yaml'].includes(ext)) {
                outputs.push({ type: ext as OutputType, path });
                continue;
            }
            log.warn(`output file path %S has ${
                ext ? `unsupported extension ${ext}` : 'no extension'
            }, %k data will be written to file`, file, output);
            outputs.push({ type: output, path });
        }
    }
    return { outputs, ...spec };
}

const defaultTerminalOptions: Required<PickOptional<TerminalOptions>> = {
    tabSize: 8,
    cursorHidden: false,
    windowTitle: undefined,
    windowIcon: undefined,
};

export function applyDefTerminalOptions(
    { columns, rows, ...options }: TerminalOptions,
    overrides?: PickOptional<TerminalOptions>,
) {
    return { columns, rows, ...applyDefaults({ ...defaultTerminalOptions, ...overrides }, options) };
}

const defaultBoxShadow: Required<OmitStrict<BoxShadowOptions, 'spread' | 'blurRadius'>> = {
    dx: 0,
    dy: 0,
    color: [0, 0, 0, 0.5],
};

type FontSizeRelative = 'insetMajor' | 'insetMinor' | 'borderRadius' | 'paddingX' | 'paddingY' | 'offsetX' | 'offsetY';

const defaultRenderOptions: Required<OmitStrict<RenderOptions, 'theme' | FontSizeRelative>> = {
    fontFamily: "'Monaco', 'Cascadia Code', 'Courier New'",
    fontSize: 12,
    lineHeight: 1.2,
    columnWidth: undefined,
    iconColumnWidth: 1.6,
    decorations: true,
    boxShadow: false,
};

export function applyDefRenderOptions({
    theme,
    borderRadius,
    insetMajor,
    insetMinor,
    paddingX,
    paddingY,
    offsetX,
    offsetY,
    ...options
}: RenderOptions) {
    const { boxShadow, fontSize, ...defaultsApplied } = applyDefaults(defaultRenderOptions, options);
    // resolve box shadow
    let resolvedBoxShadow: Required<BoxShadowOptions> | null = null;
    if (boxShadow) {
        const { spread, blurRadius, ...boxShadowOptions }: BoxShadowOptions = boxShadow === true ? {} : boxShadow;
        resolvedBoxShadow = {
            spread: spread ?? fontSize * 0.125,
            blurRadius: blurRadius ?? fontSize * 0.25,
            ...applyDefaults(defaultBoxShadow, boxShadowOptions),
        };
    }
    return {
        ...defaultsApplied,
        fontSize,
        borderRadius: borderRadius ?? fontSize * 0.25,
        insetMajor: insetMajor ?? fontSize * 2.5,
        insetMinor: insetMinor ?? fontSize * 1.25,
        paddingX: paddingX ?? fontSize * 0.25,
        paddingY: paddingY ?? fontSize * 0.25,
        offsetX: offsetX ?? fontSize * 0.75,
        offsetY: offsetY ?? fontSize * 0.75,
        theme: resolveTheme(theme),
        boxShadow: resolvedBoxShadow,
    };
}