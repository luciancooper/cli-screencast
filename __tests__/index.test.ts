import { renderScreen, renderSpawn, renderCapture } from '../src';

const dimensions = { columns: 50, rows: 10 };

describe('renderScreen', () => {
    test('promises a string when type is `svg`', async () => {
        await expect(
            renderScreen('Hello World!', { ...dimensions, type: 'svg', cursor: true })
                .then((value) => typeof value),
        ).resolves.toBe('string');
    });

    test('promises a buffer when type is `png`', async () => {
        // eslint-disable-next-line jest/valid-expect-in-promise
        await expect(
            renderScreen('Hello World!', { ...dimensions, type: 'png', cursor: true })
                .then((value) => Buffer.isBuffer(value)),
        ).resolves.toBe(true);
    });
});

describe('renderSpawn', () => {
    test('is asynchronous and promises a string', async () => {
        await expect(
            renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], dimensions)
                .then((value) => typeof value),
        ).resolves.toBe('string');
    });
});

describe('renderCapture', () => {
    test('is asynchronous and promises a string', async () => {
        await expect(
            renderCapture((source) => {
                source.write('captured write');
            }, dimensions).then((value) => typeof value),
        ).resolves.toBe('string');
    });
});