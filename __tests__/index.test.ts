import { resolve } from 'path';
import { writeFile, readFile } from 'fs/promises';
import YAML from 'yaml';
import { stdin as mockStdin } from 'mock-stdin';
import type { SourceFrame } from '@src/source';
import { renderScreen, captureFrames, captureSpawn, captureShell, captureCallback, renderData } from '../src';
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
            logLevel: 'silent',
            output: 'png',
            scaleFactor: 1,
            captureCommand: false,
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

describe('renderData', () => {
    const partial = {
        version: '1.0.0',
        columns: 50,
        rows: 10,
        tabSize: 8,
    };

    test('throws error if file extension is not json or yaml', async () => {
        await expect(renderData('./badpath.txt')).rejects.toThrow(
            "Unsupported data file type: './badpath.txt', must be json or yaml",
        );
    });

    test('throws error if file path does not exist', async () => {
        await expect(renderData('./badpath.json')).rejects.toThrow("File not found: './badpath.json'");
    });

    test('throws data validation error if file contains bad data', async () => {
        (readFile as jest.Mock).mockImplementationOnce(async () => JSON.stringify({
            ...partial,
            type: 'capture',
            endDelay: 500,
        }));
        await expect(renderData('./invalid.json')).rejects.toThrow(
            'Invalid data:\n'
            + "\n * missing 'writes' field",
        );
    });

    test('renders screen data from file', async () => {
        (readFile as jest.Mock).mockImplementationOnce(async () => YAML.stringify({
            ...partial,
            type: 'screen',
            content: 'Hello World!',
            cursorHidden: true,
        }));
        await expect(renderData('./data.yaml', { embedFonts: false })).resolves.toBeString();
    });

    test('renders capture data from file', async () => {
        (readFile as jest.Mock).mockImplementationOnce(async () => JSON.stringify({
            ...partial,
            type: 'capture',
            writes: [{ content: 'Hello World!', delay: 0 }],
            endDelay: 500,
        }));
        await expect(renderData('./data.json', { embedFonts: false })).resolves.toBeString();
    });
});