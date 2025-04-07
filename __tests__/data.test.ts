/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import nock from 'nock';
import { readFile } from 'fs/promises';
import YAML from 'yaml';
import { validateData, dataFromFile, type FileData } from '@src/data';

// mock fs.readFile
jest.mock('fs/promises', () => {
    const originalModule = jest.requireActual<typeof import('fs/promises')>('fs/promises');
    return {
        ...originalModule,
        readFile: jest.fn(originalModule.readFile),
    };
});

afterEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
});

const partial = {
    columns: 50,
    rows: 10,
    tabSize: 8,
    cursorHidden: false,
};

describe('validateData', () => {
    test('rejects data that is not an object', () => {
        const errors = ['data must be an object'];
        expect(validateData('string')).toStrictEqual({ errors });
        expect(validateData(null)).toStrictEqual({ errors });
        expect(validateData(['a', 'b'])).toStrictEqual({ errors });
    });

    test('rejects data that does not have required fields', () => {
        expect(validateData({})).toStrictEqual({
            errors: [
                "missing 'version' field",
                "missing 'type' field",
                "missing 'columns' field",
                "missing 'rows' field",
                "missing 'tabSize' field",
                "missing 'cursorHidden' field",
            ],
        });
    });

    test("rejects invalid 'version' values", () => {
        const error = "'version' must be a valid semver version";
        expect(validateData({ version: 1 })).toStrictEqual({ errors: expect.arrayContaining([error]) });
        expect(validateData({ version: '1.1.0.1' })).toStrictEqual({ errors: expect.arrayContaining([error]) });
    });

    test("rejects invalid 'type' values", () => {
        const error = "'type' must be either 'capture' or 'screen'";
        expect(validateData({ type: 1 })).toStrictEqual({ errors: expect.arrayContaining([error]) });
        expect(validateData({ type: 'data' })).toStrictEqual({ errors: expect.arrayContaining([error]) });
    });

    test("rejects 'columns', 'rows', and 'tabSize' values that are not numbers", () => {
        expect(validateData(
            { columns: true, rows: '5', tabSize: [] },
        )).toStrictEqual({
            errors: expect.arrayContaining([
                "'columns' must be a number",
                "'rows' must be a number",
                "'tabSize' must be a number",
            ]),
        });
    });

    test("rejects if 'cursorHidden' is not a boolean", () => {
        expect(validateData({ cursorHidden: 'hidden' })).toStrictEqual({
            errors: expect.arrayContaining([
                "'cursorHidden' must be a boolean",
            ]),
        });
    });

    test("rejects if 'windowTitle' or 'windowIcon' are the wrong type", () => {
        expect(validateData({ windowTitle: true, windowIcon: 5 })).toStrictEqual({
            errors: expect.arrayContaining([
                "'windowTitle' must be a string",
                "'windowIcon' must be a string or boolean",
            ]),
        });
    });

    describe('screen data', () => {
        const base = { version: '1.0.0', type: 'screen', ...partial };

        test("rejects if 'content' is omitted", () => {
            expect(validateData({ ...base })).toStrictEqual({
                errors: expect.arrayContaining([
                    "missing 'content' field",
                ]),
            });
        });

        test("rejects if 'content' is not a string", () => {
            expect(validateData({ ...base, content: true })).toStrictEqual({
                errors: expect.arrayContaining([
                    "'content' must be a string",
                ]),
            });
        });

        test("returned validated data always has 'windowTitle' and 'windowIcon' fields", () => {
            const data = { ...partial, content: '', cursorHidden: true };
            expect(validateData({
                ...base,
                ...data,
                windowTitle: 'title',
                windowIcon: true,
            })).toStrictEqual({
                type: 'screen',
                data: { ...data, windowTitle: 'title', windowIcon: true },
            });
            expect(validateData({ ...base, ...data })).toStrictEqual({
                type: 'screen',
                data: { ...data, windowTitle: undefined, windowIcon: undefined },
            });
        });
    });

    describe('capture data', () => {
        const base = { version: '1.0.0', type: 'capture', ...partial };

        test("rejects if 'command' is not a string", () => {
            expect(validateData({ ...base, command: [] })).toStrictEqual({
                errors: expect.arrayContaining([
                    "'command' must be a string",
                ]),
            });
        });

        test("rejects if 'writes' or 'endDelay' are omitted", () => {
            expect(validateData({ ...base })).toStrictEqual({
                errors: expect.arrayContaining([
                    "missing 'writes' field",
                    "missing 'endDelay' field",
                ]),
            });
        });

        test("rejects if 'endDelay' or 'writes' are the wrong type", () => {
            expect(validateData(
                { ...base, endDelay: '500', writes: 'writes' },
            )).toStrictEqual({
                errors: expect.arrayContaining([
                    "'endDelay' must be a number",
                    "'writes' must be an array",
                ]),
            });
        });

        test("rejects if elements of 'writes' are not objects", () => {
            expect(validateData(
                { ...base, writes: ['write', []] },
            )).toStrictEqual({
                errors: expect.arrayContaining([
                    "'writes' element[0] must be an object",
                    "'writes' element[1] must be an object",
                ]),
            });
        });

        test("rejects if elements of 'writes' are missing fields", () => {
            expect(validateData(
                { ...base, writes: [{ content: 'first' }, { delay: 50 }] },
            )).toStrictEqual({
                errors: expect.arrayContaining([
                    "'writes' element[0] missing 'delay' field",
                    "'writes' element[1] missing 'content' field",
                ]),
            });
        });

        test("rejects if elements of 'writes' have fields of the wrong type", () => {
            expect(validateData(
                { ...base, writes: [{ content: [], delay: '50' }] },
            )).toStrictEqual({
                errors: expect.arrayContaining([
                    "'writes' element[0] 'content' must be a string",
                    "'writes' element[0] 'delay' must be a number",
                ]),
            });
        });

        test('valid data is returned without errors', () => {
            const data = { ...partial, writes: [{ content: 'first', delay: 0 }], endDelay: 500 };
            expect(validateData({ ...base, ...data })).toStrictEqual({
                type: 'capture',
                data: {
                    ...partial,
                    ...data,
                    command: undefined,
                    windowTitle: undefined,
                    windowIcon: undefined,
                },
            });
        });
    });
});

describe('dataFromFile', () => {
    test('throws error if local file extension is not json or yaml', async () => {
        await expect(dataFromFile('./badpath.txt')).rejects.toThrow(
            "Unsupported data file type: './badpath.txt', must be json or yaml",
        );
    });

    test('throws error if remote file extension is not json or yaml', async () => {
        await expect(dataFromFile('https://cli-screencast.io/badpath.txt')).rejects.toThrow(
            "Unsupported data file type: 'https://cli-screencast.io/badpath.txt', must be json or yaml",
        );
    });

    test('throws error if file path does not exist', async () => {
        await expect(dataFromFile('./badpath.json')).rejects.toThrow("File not found: './badpath.json'");
    });

    test('handles error if remote file does not exist', async () => {
        nock('https://cli-screencast.io').get('/badpath.json').reply(404);
        await expect(dataFromFile('https://cli-screencast.io/badpath.json')).rejects.toThrow(
            "Failed to fetch file: 'https://cli-screencast.io/badpath.json', received response status 404",
        );
    });

    test('handles network errors when fetching remote files', async () => {
        nock('https://cli-screencast.io').get('/capture.json').replyWithError('mocked network error');
        await expect(dataFromFile('https://cli-screencast.io/capture.json')).rejects.toThrow('mocked network error');
    });

    test('throws data validation error if file has missing data', async () => {
        jest.mocked(readFile).mockImplementationOnce(async () => JSON.stringify({
            version: '1.0.0',
            type: 'capture',
            ...partial,
            endDelay: 500,
        }));
        await expect(dataFromFile('./invalid.json')).rejects.toThrow(
            'Invalid data:\n'
            + "\n * missing 'writes' field",
        );
    });

    test('parse screen data from local yml file', async () => {
        const data = { ...partial, content: 'Hello World!' };
        jest.mocked(readFile).mockImplementationOnce(async () => YAML.stringify(
            { version: '1.0.0', type: 'screen', ...data },
        ));
        await expect(dataFromFile('./data.yml')).resolves.toMatchObject<FileData>({
            type: 'screen',
            data: { ...data, windowTitle: undefined, windowIcon: undefined },
        });
    });

    test('parse capture data from remote json file', async () => {
        const data = { ...partial, writes: [{ content: 'Hello World!', delay: 0 }], endDelay: 500 };
        nock('https://cli-screencast.io').get('/capture.json').reply(200, JSON.stringify(
            { version: '1.0.0', type: 'capture', ...data },
        ));
        await expect(dataFromFile('https://cli-screencast.io/capture.json')).resolves.toMatchObject<FileData>({
            type: 'capture',
            data: {
                ...data,
                windowTitle: undefined,
                windowIcon: undefined,
                command: undefined,
            },
        });
    });
});