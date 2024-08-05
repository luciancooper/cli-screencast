/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { validateData } from '@src/data';

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

    const partial = { columns: 50, rows: 10, tabSize: 8 };

    describe('screen data', () => {
        const base = { version: '1.0.0', type: 'screen', ...partial };

        test("rejects if 'content' or 'cursorHidden' are omitted", () => {
            expect(validateData({ ...base })).toStrictEqual({
                errors: expect.arrayContaining([
                    "missing 'content' field",
                    "missing 'cursorHidden' field",
                ]),
            });
        });

        test("rejects if 'content' or 'cursorHidden' are the wrong type", () => {
            expect(validateData(
                { ...base, content: true, cursorHidden: 'hidden' },
            )).toStrictEqual({
                errors: expect.arrayContaining([
                    "'content' must be a string",
                    "'cursorHidden' must be a boolean",
                ]),
            });
        });

        test("rejects if 'windowTitle' or 'windowIcon' are the wrong type", () => {
            expect(validateData({
                ...base,
                content: '',
                cursorHidden: true,
                windowTitle: true,
                windowIcon: 5,
            })).toStrictEqual({
                errors: expect.arrayContaining([
                    "'windowTitle' must be a string",
                    "'windowIcon' must be a string or boolean",
                ]),
            });
        });

        test("returned validated data always has 'windowTitle' and 'windowIcon' fields", () => {
            const data = { ...partial, content: '', cursorHidden: true };
            expect(validateData({
                ...base,
                content: '',
                cursorHidden: true,
                windowTitle: 'title',
                windowIcon: true,
            })).toStrictEqual({
                type: 'screen',
                data: { ...data, windowTitle: 'title', windowIcon: true },
            });
            expect(validateData({ ...base, content: '', cursorHidden: true })).toStrictEqual({
                type: 'screen',
                data: { ...data, windowTitle: undefined, windowIcon: undefined },
            });
        });
    });

    describe('capture data', () => {
        const base = { version: '1.0.0', type: 'capture', ...partial };

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
            expect(validateData(
                { ...base, writes: [{ content: 'first', delay: 0 }], endDelay: 500 },
            )).toStrictEqual({
                type: 'capture',
                data: { ...partial, writes: [{ content: 'first', delay: 0 }], endDelay: 500 },
            });
        });
    });
});