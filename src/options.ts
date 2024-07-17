import type { PickOptional, Dimensions, OutputOptions, OutputType, TerminalOptions } from './types';
import { defaultBoxShadow, type RenderOptions } from './render';
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
            log.warn(`output file path %O has ${
                ext ? `unsupported extension ${ext}` : 'no extension'
            }, ${output} data will be written to file`, file);
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

const defaultRenderOptions: Required<Omit<RenderOptions, 'theme'>> = {
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
    offsetY: 12,
    offsetX: 12,
    boxShadow: false,
};

export function applyDefRenderOptions({ theme, ...options }: RenderOptions) {
    const { boxShadow, ...defaultsApplied } = applyDefaults(defaultRenderOptions, options);
    return {
        ...defaultsApplied,
        theme: resolveTheme(theme),
        boxShadow: boxShadow ? applyDefaults(defaultBoxShadow, boxShadow !== true ? boxShadow : {}) : false as const,
    };
}