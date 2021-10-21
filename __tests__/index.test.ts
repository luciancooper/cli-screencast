import { renderScreen, renderSpawn, renderCapture } from '../src';

const dimensions = { columns: 50, rows: 10 };

describe('renderScreen', () => {
    test('promises a string when output type is `svg`', async () => {
        await expect(
            renderScreen('Hello World!', dimensions)
                .then((value) => typeof value),
        ).resolves.toBe('string');
    });

    test('promises a buffer when output type is `png`', async () => {
        await expect(renderScreen('Hello World!', {
            ...dimensions,
            output: 'png',
            cursorHidden: false,
            scaleFactor: 1,
        }).then((value) => Buffer.isBuffer(value))).resolves.toBe(true);
    });
});

describe('renderSpawn', () => {
    test('promises a string when output type is `svg`', async () => {
        await expect(
            renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], dimensions)
                .then((value) => typeof value),
        ).resolves.toBe('string');
    });

    test('promises a buffer when output type is `png`', async () => {
        await expect(renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], {
            ...dimensions,
            output: 'png',
            scaleFactor: 1,
        }).then((value) => Buffer.isBuffer(value))).resolves.toBe(true);
    });
});

describe('renderCapture', () => {
    test('promises a string when output type is `svg`', async () => {
        await expect(
            renderCapture((source) => {
                source.write('captured write');
            }, dimensions).then((value) => typeof value),
        ).resolves.toBe('string');
    });

    test('promises a buffer when output type is `png`', async () => {
        await expect(
            renderCapture((source) => {
                source.write('captured write');
            }, { ...dimensions, output: 'png', scaleFactor: 1 }).then((value) => Buffer.isBuffer(value)),
        ).resolves.toBe(true);
    });
});