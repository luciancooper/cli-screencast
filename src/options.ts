import type { PickOptional, OutputOptions, TerminalOptions } from './types';
import type { RenderOptions } from './render';
import { resolveTheme } from './theme';

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
    scaleFactor: 4,
    embedFonts: true,
};

export function applyDefOutputOptions(options: OutputOptions) {
    return applyDefaults(defaultOutputOptions, options);
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
};

export function applyDefRenderOptions({ theme, ...options }: RenderOptions) {
    return { ...applyDefaults(defaultRenderOptions, options), theme: resolveTheme(theme) };
}