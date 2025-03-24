import nock from 'nock';
import { resolve } from 'path';
import { writeFile, readFile } from 'fs/promises';
import YAML from 'yaml';
import { stdin as mockStdin } from 'mock-stdin';
import type { SourceFrame } from '@src/source';
import { renderScreen, captureFrames, captureSpawn, captureShell, captureCallback, renderData } from '@src';
import mockStdout, { type MockStdout } from './helpers/mockStdout';

const dimensions = { columns: 50, rows: 10 };

const outputPaths = {
    svg: resolve('./file.svg'),
    png: resolve('./file.png'),
    json: resolve('./file.json'),
    yaml: resolve('./file.yaml'),
} as const;

// mock fs so tests don't actually write out to any output files
jest.mock('fs/promises', () => {
    const originalModule = jest.requireActual<typeof import('fs/promises')>('fs/promises');
    return {
        ...originalModule,
        mkdir: jest.fn(async () => {}),
        writeFile: jest.fn(async () => {}),
        readFile: jest.fn(originalModule.readFile),
    };
});

afterEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
});

describe('renderScreen', () => {
    test('promises a string when output type is `json`', async () => {
        await expect(renderScreen('Hello World!', {
            ...dimensions,
            output: 'json',
            outputPath: [outputPaths.json, outputPaths.yaml],
        })).resolves.toBeString();
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.json, expect.toBeString());
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.yaml, expect.toBeString());
    });

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
            outputPath: [outputPaths.json, outputPaths.svg, outputPaths.png],
            cursorHidden: false,
            scaleFactor: 1,
        });
        expect(Buffer.isBuffer(png)).toBe(true);
        expect(writeFile).toHaveBeenCalledTimes(3);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.json, expect.toBeString());
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.svg, expect.toBeString());
        expect(writeFile).toHaveBeenNthCalledWith(3, outputPaths.png, png);
    });
});

describe('captureFrames', () => {
    const frames: SourceFrame[] = [
        { content: 'line 1', duration: 500 },
        { content: 'line 2', duration: 500 },
        { content: 'line 3', duration: 500 },
    ];

    test('promises a string when output type is `json`', async () => {
        await expect(captureFrames(frames, {
            ...dimensions,
            output: 'json',
            outputPath: [outputPaths.json, outputPaths.yaml],
        })).resolves.toBeString();
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.json, expect.toBeString());
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.yaml, expect.toBeString());
    });

    test('promises a string when output type is `svg`', async () => {
        const svg = await captureFrames(frames, {
            ...dimensions,
            embedFonts: false,
            outputPath: [outputPaths.json, outputPaths.svg],
        });
        expect(svg).toBeString();
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.json, expect.toBeString());
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.svg, svg);
    });
});

describe('captureSpawn', () => {
    test('promises a string when output type is `svg`', async () => {
        await expect(
            captureSpawn('node', ['-e', "process.stdout.write('Hello World!');"], dimensions),
        ).resolves.toBeString();
    });

    test('promises a buffer when output type is `png`', async () => {
        await expect(captureSpawn('node', ['-e', "process.stdout.write('Hello World!');"], {
            ...dimensions,
            output: 'png',
            scaleFactor: 1,
            includeCommand: false,
        }).then((value) => Buffer.isBuffer(value))).resolves.toBe(true);
    });
});

describe('captureShell', () => {
    let stdout: MockStdout,
        stdin: ReturnType<typeof mockStdin>;

    beforeAll(() => {
        stdout = mockStdout();
        stdin = mockStdin();
    });

    afterEach(() => {
        stdout.reset();
    });

    afterAll(() => {
        stdout.restore();
        stdin.restore();
    });

    test('promises a string when output type is `yaml`', async () => {
        const shell = captureShell({ ...dimensions, output: 'yaml' });
        // send mocks stdin after first write to stdout
        await stdout.nextWrite().then(() => {
            stdin.send('\x04');
        });
        // await rendering of shell
        await expect(shell).resolves.toBeString();
    });
});

describe('captureCallback', () => {
    test('promises a string when output type is `svg`', async () => {
        const svg = await captureCallback((source) => {
            source.write('captured write');
        }, { ...dimensions, outputPath: outputPaths.svg });
        expect(svg).toBeString();
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(outputPaths.svg, svg);
    });

    test('promises a buffer when output type is `png`', async () => {
        const png = await captureCallback((source) => {
            source.write('captured write');
        }, {
            ...dimensions,
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

describe('renderData', () => {
    const partial = { version: '1.0.0', ...dimensions, tabSize: 8 };

    test('throws validation error if data file is incomplete', async () => {
        (readFile as jest.Mock).mockImplementationOnce(async () => JSON.stringify({ ...partial, type: 'capture' }));
        await expect(renderData('./invalid.json')).rejects.toThrow(/^Invalid data:/);
    });

    test('render screen data from local yaml file', async () => {
        (readFile as jest.Mock).mockImplementationOnce(async () => YAML.stringify({
            type: 'screen',
            ...partial,
            cursorHidden: true,
            content: 'Hello World!',
        }));
        await expect(renderData('./data.yaml', { embedFonts: false })).resolves.toBeString();
    });

    test('render capture data from remote json file', async () => {
        nock('https://cli-screencast.io').get('/capture.json').reply(200, JSON.stringify({
            type: 'capture',
            ...partial,
            cursorHidden: false,
            writes: [{ content: 'Hello World!', delay: 500 }],
            endDelay: 500,
        }));
        await expect(renderData('https://cli-screencast.io/capture.json', { embedFonts: false })).resolves.toBeString();
    });
});