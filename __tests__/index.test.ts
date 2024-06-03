import { resolve } from 'path';
import { writeFile } from 'fs/promises';
import { renderScreen, renderFrames, renderSpawn, renderCallback } from '../src';

const dimensions = { columns: 50, rows: 10 };

const outputPaths = {
    svg: resolve(process.cwd(), './file.svg'),
    png: resolve(process.cwd(), './file.png'),
} as const;

// mock fs so tests don't actually write out to any output files
jest.mock('fs/promises', () => {
    const originalModule = jest.requireActual<typeof import('fs/promises')>('fs/promises');
    return {
        ...originalModule,
        mkdir: jest.fn(async () => {}),
        writeFile: jest.fn(async () => {}),
    };
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('renderScreen', () => {
    test('promises a string when output type is `svg`', async () => {
        const svg = await renderScreen('Hello World!', {
            ...dimensions,
            embedFonts: false,
            outputPath: outputPaths.svg,
        });
        expect(svg).toBeString();
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(outputPaths.svg, svg);
    });

    test('promises a buffer when output type is `png`', async () => {
        const png = await renderScreen('Hello World!', {
            ...dimensions,
            output: 'png',
            outputPath: [outputPaths.svg, outputPaths.png],
            cursorHidden: false,
            scaleFactor: 1,
        });
        expect(Buffer.isBuffer(png)).toBe(true);
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.svg, expect.toBeString());
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.png, png);
    });
});

describe('renderFrames', () => {
    test('renders animated svg from array of content frames', async () => {
        const svg = await renderFrames([
            { content: 'line 1', duration: 500 },
            { content: 'line 2', duration: 500 },
            { content: 'line 3', duration: 500 },
        ], { ...dimensions, embedFonts: false, outputPath: outputPaths.svg });
        expect(svg).toBeString();
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(outputPaths.svg, svg);
    });
});

describe('renderSpawn', () => {
    test('promises a string when output type is `svg`', async () => {
        await expect(
            renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], dimensions),
        ).resolves.toBeString();
    });

    test('promises a buffer when output type is `png`', async () => {
        await expect(renderSpawn('node', ['-e', "process.stdout.write('Hello World!');"], {
            ...dimensions,
            logLevel: 'silent',
            output: 'png',
            scaleFactor: 1,
            captureCommand: false,
        }).then((value) => Buffer.isBuffer(value))).resolves.toBe(true);
    });
});

describe('renderCallback', () => {
    test('promises a string when output type is `svg`', async () => {
        const svg = await renderCallback((source) => {
            source.write('captured write');
        }, { ...dimensions, outputPath: outputPaths.svg });
        expect(svg).toBeString();
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(outputPaths.svg, svg);
    });

    test('promises a buffer when output type is `png`', async () => {
        const png = await renderCallback((source) => {
            source.write('captured write');
        }, {
            ...dimensions,
            logLevel: 'silent',
            output: 'png',
            embedFonts: false,
            outputPath: [outputPaths.svg, outputPaths.png],
            scaleFactor: 1,
        });
        expect(Buffer.isBuffer(png)).toBe(true);
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.svg, expect.toBeString());
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.png, png);
    });
});