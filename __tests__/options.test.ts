import path from 'path';
import { applyDefaults, applyDefOutputOptions } from '@src/options';
import { setLogLevel } from '@src/logger';

setLogLevel('error');

describe('applyDefaults', () => {
    test('applys default values to options object', () => {
        expect(applyDefaults({ a: 2, b: 3 }, { a: 1 })).toStrictEqual({ a: 1, b: 3 });
    });

    test('returns object with only  the keys from the defaults spec', () => {
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