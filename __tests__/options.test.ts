import path from 'path';
import { validateOptions, applyDefaults, applyDefOutputOptions, applyDefRenderOptions } from '@src/options';
import type { Dimensions } from '@src/types';
import { applyLoggingOptions, resetLogLevel } from '@src/logger';

beforeAll(() => {
    applyLoggingOptions({ logLevel: 'error' });
});

afterAll(() => {
    resetLogLevel();
});

describe('validateOptions', () => {
    test('throws error if columns and rows options are not specified', () => {
        expect(() => {
            validateOptions({} as unknown as Dimensions);
        }).toThrow("Invalid options spec, 'columns' and 'rows' options must be provided");
    });

    test('throws error if columns and rows options are the wrong type', () => {
        expect(() => {
            validateOptions({ columns: '50', rows: '30' } as unknown as Dimensions);
        }).toThrow("Invalid options spec, 'columns' and 'rows' options must be provided");
    });

    test('does not throw if columns and rows options are valid', () => {
        expect(() => {
            validateOptions({ columns: 50, rows: 30 } as unknown as Dimensions);
        }).not.toThrow("Invalid options spec, 'columns' and 'rows' options must be provided");
    });
});

describe('applyDefaults', () => {
    test('applys default values to options object', () => {
        expect(applyDefaults({ a: 2, b: 3 }, { a: 1 })).toStrictEqual({ a: 1, b: 3 });
    });

    test('returns object with only the keys from the defaults spec', () => {
        expect(applyDefaults({ a: 2, b: 3 }, { a: 1, c: 4 })).toStrictEqual({ a: 1, b: 3 });
    });
});

describe('applyDefOutputOptions', () => {
    test('always returns output spec for the output data type', () => {
        expect(applyDefOutputOptions({}).outputs).toStrictEqual([
            { type: 'svg', path: null },
        ]);
    });

    test('infers type of output from file extension', () => {
        expect(applyDefOutputOptions({
            outputPath: ['./file.png', './file.JSON'],
        }).outputs).toStrictEqual([
            { type: 'svg', path: null },
            { type: 'png', path: path.resolve('./file.png') },
            { type: 'json', path: path.resolve('./file.JSON') },
        ]);
    });

    test('supports `yml` as an alias for `yaml`', () => {
        expect(applyDefOutputOptions({
            output: 'yml',
            outputPath: ['./file.yaml', './file.yml'],
        }).outputs).toStrictEqual([
            { type: 'yaml', path: null },
            { type: 'yaml', path: path.resolve('./file.yaml') },
            { type: 'yaml', path: path.resolve('./file.yml') },
        ]);
    });

    test('output paths can be absolute', () => {
        const file = path.resolve('./file.svg');
        expect(applyDefOutputOptions({
            outputPath: file,
        }).outputs).toStrictEqual([
            { type: 'svg', path: null },
            { type: 'svg', path: file },
        ]);
    });

    test('falls back to output type if outputPaths have irregular file extensions', () => {
        expect(applyDefOutputOptions({
            output: 'png',
            outputPath: ['./file', './file.jpg'],
        }).outputs).toStrictEqual([
            { type: 'png', path: null },
            { type: 'png', path: path.resolve('./file') },
            { type: 'png', path: path.resolve('./file.jpg') },
        ]);
    });
});

describe('applyDefRenderOptions', () => {
    test('adjusts default window dimension values relative to the font size', () => {
        expect(applyDefRenderOptions({ fontSize: 16, boxShadow: true })).toMatchObject({
            fontSize: 16,
            borderRadius: 4,
            insetMajor: 40,
            insetMinor: 20,
            paddingX: 4,
            paddingY: 4,
            offsetX: 12,
            offsetY: 12,
            boxShadow: {
                dx: 0,
                dy: 0,
                spread: 2,
                blurRadius: 4,
                color: [0, 0, 0, 0.5],
            },
        });
    });

    test('applies defaults to missing fields if a partial box shadow config is specified', () => {
        expect(applyDefRenderOptions({ fontSize: 16, boxShadow: { dx: 2, dy: 3 } }).boxShadow).toStrictEqual({
            dx: 2,
            dy: 3,
            spread: 2,
            blurRadius: 4,
            color: [0, 0, 0, 0.5],
        });
    });
});