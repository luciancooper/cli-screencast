import { renderScreen, renderSpawn } from '../src';

const dimensions = { columns: 50, rows: 10 };

test('renderScreen is synchronous and returns a string', () => {
    expect(typeof renderScreen('Hello World!', { ...dimensions, cursor: true })).toBe('string');
});

test('renderSpawn is asynchronous and promises a string', async () => {
    const promise = renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], dimensions);
    await expect(promise.then((value) => typeof value)).resolves.toBe('string');
});