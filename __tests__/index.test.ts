import { renderScreen, renderSpawn, renderCapture } from '../src';

const dimensions = { columns: 50, rows: 10 };

test('renderScreen is synchronous and returns a string', () => {
    expect(typeof renderScreen('Hello World!', { ...dimensions, cursor: true })).toBe('string');
});

test('renderSpawn is asynchronous and promises a string', async () => {
    await expect(
        renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], dimensions)
            .then((value) => typeof value),
    ).resolves.toBe('string');
});

test('renderCapture is asynchronous and promises a string', async () => {
    await expect(
        renderCapture((source) => {
            source.write('captured write');
        }, dimensions).then((value) => typeof value),
    ).resolves.toBe('string');
});