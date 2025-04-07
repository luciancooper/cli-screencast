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
    test('returns a json string when output type is `json`', async () => {
        await expect(renderScreen('Hello World!', {
            ...dimensions,
            output: 'json',
            outputPath: [outputPaths.json, outputPaths.yaml],
        })).resolves.toBeJson({ type: 'screen' });
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.json, expect.toBeJson({ type: 'screen' }));
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.yaml, expect.toBeYaml({ type: 'screen' }));
    });

    test('returns an svg string when output type is `svg`', async () => {
        await expect(renderScreen('Hello World!', {
            ...dimensions,
            embedFonts: false,
            outputPath: outputPaths.svg,
        })).resolves.toBeSvg();
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(outputPaths.svg, expect.toBeSvg());
    });

    test('returns a png buffer when output type is `png`', async () => {
        await expect(renderScreen('Hello World!', {
            ...dimensions,
            output: 'png',
            outputPath: [outputPaths.json, outputPaths.svg, outputPaths.png],
            cursorHidden: false,
            scaleFactor: 1,
        })).resolves.toBePng();
        expect(writeFile).toHaveBeenCalledTimes(3);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.json, expect.toBeJson({ type: 'screen' }));
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.svg, expect.toBeSvg());
        expect(writeFile).toHaveBeenNthCalledWith(3, outputPaths.png, expect.toBePng());
    });
});

describe('captureFrames', () => {
    const frames: SourceFrame[] = [
        { content: 'line 1', duration: 500 },
        { content: 'line 2', duration: 500 },
        { content: 'line 3', duration: 500 },
    ];

    test('returns a json string when output type is `json`', async () => {
        await expect(captureFrames(frames, {
            ...dimensions,
            output: 'json',
            outputPath: [outputPaths.json, outputPaths.yaml],
        })).resolves.toBeJson({ type: 'capture' });
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.json, expect.toBeJson({ type: 'capture' }));
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.yaml, expect.toBeYaml({ type: 'capture' }));
    });

    test('returns an svg string when output type is `svg`', async () => {
        await expect(captureFrames(frames, {
            ...dimensions,
            command: 'ls',
            embedFonts: false,
            outputPath: [outputPaths.json, outputPaths.svg],
        })).resolves.toBeSvg();
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.json, expect.toBeJson({
            type: 'capture',
            command: 'ls',
        }));
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.svg, expect.toBeSvg());
    });
});

describe('captureSpawn', () => {
    test('returns an svg string when output type is `svg`', async () => {
        await expect(
            captureSpawn('node', ['-e', "process.stdout.write('Hello World!');"], dimensions),
        ).resolves.toBeSvg();
    });

    test('returns a png buffer when output type is `png`', async () => {
        await expect(captureSpawn('node', ['-e', "process.stdout.write('Hello World!');"], {
            ...dimensions,
            output: 'png',
            scaleFactor: 1,
            includeCommand: false,
        })).resolves.toBePng();
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

    test('returns a yaml string when output type is `yaml`', async () => {
        const shell = captureShell({ ...dimensions, output: 'yaml' });
        // send mocks stdin after first write to stdout
        await stdout.nextWrite().then(() => {
            stdin.send('\x04');
        });
        // await rendering of shell
        await expect(shell).resolves.toBeYaml({ type: 'capture' });
    });
});

describe('captureCallback', () => {
    test('returns an svg string when output type is `svg`', async () => {
        await expect(captureCallback((source) => {
            source.write('captured write');
        }, { ...dimensions, outputPath: outputPaths.svg })).resolves.toBeSvg();
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(outputPaths.svg, expect.toBeSvg());
    });

    test('returns a png buffer when output type is `png`', async () => {
        await expect(captureCallback((source) => {
            source.write('captured write');
        }, {
            ...dimensions,
            output: 'png',
            embedFonts: false,
            outputPath: [outputPaths.svg, outputPaths.png],
            scaleFactor: 1,
        })).resolves.toBePng();
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenNthCalledWith(1, outputPaths.svg, expect.toBeSvg());
        expect(writeFile).toHaveBeenNthCalledWith(2, outputPaths.png, expect.toBePng());
    });
});

describe('renderData', () => {
    const partial = { version: '1.0.0', ...dimensions, tabSize: 8 };

    test('throws validation error if data file is incomplete', async () => {
        jest.mocked(readFile).mockImplementationOnce(async () => JSON.stringify({ ...partial, type: 'capture' }));
        await expect(renderData('./invalid.json')).rejects.toThrow(/^Invalid data:/);
    });

    test('render screen data from local yaml file', async () => {
        jest.mocked(readFile).mockImplementationOnce(async () => YAML.stringify({
            type: 'screen',
            ...partial,
            cursorHidden: true,
            content: 'Hello World!',
        }));
        await expect(renderData('./data.yaml', { embedFonts: false })).resolves.toBeSvg();
    });

    test('render capture data from remote json file', async () => {
        nock('https://cli-screencast.io').get('/capture.json').reply(200, JSON.stringify({
            type: 'capture',
            ...partial,
            cursorHidden: false,
            writes: [{ content: 'Hello World!', delay: 500 }],
            endDelay: 500,
        }));
        await expect(renderData('https://cli-screencast.io/capture.json', { embedFonts: false })).resolves.toBeSvg();
    });
});