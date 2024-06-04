/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import type { CaptureData, ScreenData } from './types';
import { version } from '../package.json';

function validateField(
    errors: string[],
    parsed: Record<string, any>,
    key: string,
    expected: 'string' | 'boolean' | 'number',
    msgPrefix = '',
) {
    if (!Object.hasOwn(parsed, key)) {
        errors.push(`${msgPrefix}missing '${key}' field`);
    // eslint-disable-next-line valid-typeof
    } else if (typeof parsed[key] !== expected) {
        errors.push(`${msgPrefix}'${key}' must be a ${expected}`);
    }
}

export function validateData(json: string) {
    let parsed = JSON.parse(json),
        data: CaptureData | ScreenData | null = null;
    const errors: string[] = [];
    if (!(parsed instanceof Object && !Array.isArray(parsed))) {
        errors.push('data must be an object');
        return { data, errors };
    }
    // validate package version field
    if (!Object.hasOwn(parsed, 'version')) {
        errors.push("missing 'version' field");
    } else if (typeof parsed.version !== 'string' || !/^\s*v?\d+(?:\.\d+){0,2}\s*$/.test(parsed.version)) {
        errors.push("'version' must be a valid semver version");
    }
    // validate 'type' field
    let type: 'capture' | 'screen' | null = null;
    if (!Object.hasOwn(parsed, 'type')) {
        errors.push("missing 'type' field");
    } else if (parsed.type !== 'capture' && parsed.type !== 'screen') {
        errors.push("'type' must be either 'capture' or 'screen'");
    } else {
        ({ type, ...parsed } = parsed);
    }
    // validate shared numerical fields 'columns', 'rows', 'tabSize'
    for (const key of ['columns', 'rows', 'tabSize']) validateField(errors, parsed, key, 'number');
    // stop if data does not have a valid 'type' field
    if (!type) return { data, errors };
    // delete version field
    delete parsed.version;
    // validate 'screen' type fields
    if (type === 'screen') {
        // validate 'content' field
        validateField(errors, parsed, 'content', 'string');
        // validate 'cursorHidden' field
        validateField(errors, parsed, 'cursorHidden', 'boolean');
        // validate 'windowTitle' field
        if (!Object.hasOwn(parsed, 'windowTitle')) {
            parsed.windowTitle = undefined;
        } else if (typeof parsed.windowTitle !== 'string') {
            errors.push("'windowTitle' must be a string");
        }
        // validate 'windowIcon' field
        if (!Object.hasOwn(parsed, 'windowIcon')) {
            parsed.windowIcon = undefined;
        } else if (typeof parsed.windowIcon !== 'string' && typeof parsed.windowIcon !== 'boolean') {
            errors.push("'windowIcon' must be a string or boolean");
        }
        // cast json to ScreenData if there are no validation errors
        if (!errors.length) data = parsed as ScreenData;
    } else {
        // validate 'endDelay' field
        validateField(errors, parsed, 'endDelay', 'number');
        // validate 'writes' field
        if (!Object.hasOwn(parsed, 'writes')) {
            errors.push("missing 'writes' field");
        } else if (!Array.isArray(parsed.writes)) {
            errors.push("'writes' must be an array");
        } else {
            // validate each element in 'writes'
            const writeErrors: string[] = [];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            for (const [i, item] of parsed.writes.entries()) {
                if (!(item instanceof Object && !Array.isArray(item))) {
                    writeErrors.push(`'writes' element[${i}] must be an object`);
                    continue;
                }
                validateField(writeErrors, item, 'content', 'string', `'writes' element[${i}] `);
                validateField(writeErrors, item, 'delay', 'number', `'writes' element[${i}] `);
            }
            // add a maximum of 5 write element errors to errors array as to not overflow
            errors.push(...writeErrors.slice(0, 5));
        }
        // cast json to CaptureData if there are no validation errors
        if (!errors.length) data = parsed as CaptureData;
    }
    return { data, errors };
}

export function dataFromJson(json: string): ScreenData | CaptureData {
    const { data, errors } = validateData(json);
    if (errors.length) {
        throw new Error(`Invalid JSON data:\n${errors.map((e) => `\n * ${e}`).join('')}`);
    }
    return data!;
}

interface JSONOutput {
    data: string
    pretty: string
}

export function dataToJson(type: 'capture', data: CaptureData): JSONOutput;
export function dataToJson(type: 'screen', data: ScreenData): JSONOutput;
export function dataToJson(type: 'capture' | 'screen', data: CaptureData | ScreenData): JSONOutput {
    const json = { version, type, ...data };
    return { data: JSON.stringify(json), pretty: JSON.stringify(json, null, 4) };
}