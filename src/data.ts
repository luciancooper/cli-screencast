/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { readFile } from 'fs/promises';
import { extname } from 'path';
import YAML from 'yaml';
import type { CaptureData, ScreenData } from './types';
import { resolveFilePath, parseUrl, fetchData } from './utils';
import log from './logger';
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

function validateOptionalField(
    errors: string[],
    parsed: Record<string, any>,
    key: string,
    expected: 'string' | 'boolean' | 'number' | ('string' | 'boolean' | 'number')[],
) {
    if (Object.hasOwn(parsed, key)) {
        const type = typeof parsed[key];
        if (Array.isArray(expected)) {
            if (!(expected as string[]).includes(type)) {
                errors.push(`'${key}' must be a ${expected.join(' or ')}`);
            }
        } else if (type !== expected) {
            errors.push(`'${key}' must be a ${expected}`);
        }
    } else {
        parsed[key] = undefined;
    }
}

type FileData = { type: 'capture', data: CaptureData } | { type: 'screen', data: ScreenData };

export function validateData(parsed: any): FileData | { errors: string[] } {
    const errors: string[] = [];
    if (!(parsed instanceof Object && !Array.isArray(parsed))) {
        errors.push('data must be an object');
        return { errors };
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
        // eslint-disable-next-line no-param-reassign
        ({ type, ...parsed } = parsed);
    }
    // validate shared numerical fields 'columns', 'rows', 'tabSize'
    for (const key of ['columns', 'rows', 'tabSize']) validateField(errors, parsed, key, 'number');
    // validate shared 'cursorHidden' field
    validateField(errors, parsed, 'cursorHidden', 'boolean');
    // validate shared 'windowTitle' field
    validateOptionalField(errors, parsed, 'windowTitle', 'string');
    // validate shared 'windowIcon' field
    validateOptionalField(errors, parsed, 'windowIcon', ['string', 'boolean']);
    // stop if data does not have a valid 'type' field
    if (!type) return { errors };
    // delete version field
    delete parsed.version;
    // validate 'screen' and 'capture' file types differently
    if (type === 'screen') {
        // validate 'content' field
        validateField(errors, parsed, 'content', 'string');
    } else {
        // validate 'command' field
        validateOptionalField(errors, parsed, 'command', 'string');
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
    }
    return errors.length ? { errors } : { type, data: parsed };
}

export async function dataFromFile(file: string): Promise<FileData> {
    // resolve file path or url and file extension
    let path: string,
        ext: string;
    const url = parseUrl(file);
    if (url) {
        [path, ext] = [url.href, extname(url.pathname)];
        if (ext.startsWith('.')) ext = ext.slice(1);
        ext = ext.toLowerCase();
    } else {
        ({ path, ext } = resolveFilePath(file));
    }
    // check data file extension
    if (!['json', 'yaml', 'yml'].includes(ext)) {
        throw new Error(`Unsupported data file type: '${file}', must be json or yaml`);
    }
    // read contents of data file
    let content: string;
    if (url) {
        // fetch file content from remote source
        const res = await fetchData(url);
        if (res.status !== 200) {
            throw new Error(`Failed to fetch file: '${url.href}', received response status ${res.status}`);
        }
        content = res.data!.toString('utf8');
    } else {
        // read local data file
        try {
            content = (await readFile(path)).toString();
        } catch (err) {
            throw new Error(`File not found: '${file}'`);
        }
    }
    // validate the data
    const result = validateData(ext === 'json' ? JSON.parse(content) : YAML.parse(content));
    // throw error if validation failed
    if ('errors' in result) {
        throw new Error(`Invalid data:\n${result.errors.map((e) => `\n * ${e}`).join('')}`);
    }
    log.info('read %s data from %p', result.type, path);
    return result;
}

interface JSONOutput {
    data: string
    pretty: string
}

export function dataToJson(type: 'capture', data: CaptureData): JSONOutput;
export function dataToJson(type: 'screen', data: ScreenData): JSONOutput;
export function dataToJson(type: 'capture' | 'screen', data: CaptureData | ScreenData): JSONOutput {
    const json = { version, type, ...data };
    return { data: JSON.stringify(json), pretty: JSON.stringify(json, null, 2) };
}

export function dataToYaml(type: 'capture', data: CaptureData): string;
export function dataToYaml(type: 'screen', data: ScreenData): string;
export function dataToYaml(type: 'capture' | 'screen', data: CaptureData | ScreenData): string {
    return YAML.stringify({ version, type, ...data }, { lineWidth: 200, blockQuote: false });
}