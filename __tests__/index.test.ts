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
        await expect(renderScreen('Hello World!', {
            ...dimensions,
            type: 'png',
            cursor: true,
            scaleFactor: 1,
        }).then((value) => Buffer.isBuffer(value))).resolves.toBe(true);
    });
});

describe('renderSpawn', () => {
    test('promises a string when type is `svg`', async () => {
        await expect(
            renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], { ...dimensions, type: 'svg' })
                .then((value) => typeof value),
        ).resolves.toBe('string');
    });

    test('promises a buffer when type is `png`', async () => {
        // eslint-disable-next-line jest/valid-expect-in-promise
        await expect(renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], {
            ...dimensions,
            type: 'png',
            scaleFactor: 1,
        }).then((value) => Buffer.isBuffer(value))).resolves.toBe(true);
    });
});

describe('renderCapture', () => {
    test('promises a string when type is `svg`', async () => {
        await expect(
            renderCapture((source) => {
                source.write('captured write');
            }, { ...dimensions, type: 'svg' }).then((value) => typeof value),
        ).resolves.toBe('string');
    });

    test('promises a buffer when type is `png`', async () => {
        // eslint-disable-next-line jest/valid-expect-in-promise
        await expect(
            renderCapture((source) => {
                source.write('captured write');
            }, { ...dimensions, type: 'png', scaleFactor: 1 }).then((value) => Buffer.isBuffer(value)),
        ).resolves.toBe(true);
    });
});