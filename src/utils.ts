import { resolve, extname, dirname } from 'path';
import { readFile, mkdir, writeFile } from 'fs/promises';

/**
 * Resolve a file path relative to the current working directory
 * @param file - path to resolve
 * @returns absolute file path
 */
export function resolveFilePath(file: string) {
    const path = resolve(file);
    let ext = extname(path);
    if (ext.startsWith('.')) ext = ext.slice(1);
    return { path, ext };
}

/**
 * Read the contents of a file. Path is resolved relative to the current working directory
 * @param file - file path to read
 * @returns contents of the file
 */
export async function readFromFile(file: string) {
    const path = resolve(file);
    try {
        return (await readFile(path)).toString();
    } catch (err) {
        throw new Error(`File not found: '${file}'`);
    }
}

/**
 * Write content to a file path. Parent directory will be created recursively if it does not exist.
 * @param path - absolute file path to write to
 * @param content - content to write to file
 */
export async function writeToFile(path: string, content: string | Buffer) {
    const dir = dirname(path);
    // create parent directory if it doesn't exist
    try {
        await mkdir(dir, { recursive: true });
    } catch {}
    // write data to file
    await writeFile(path, content);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const promisePrototype = (async () => {})().constructor.prototype;

const descriptors = (['then', 'catch', 'finally'] as const)
    .map((p) => [p, Reflect.getOwnPropertyDescriptor(promisePrototype, p)!] as const);

/**
 * Merge a promise into an object to make it promise like
 * @param obj - object to merge with promise
 * @param promise - promise to merge
 */
export function mergePromise<T extends object, P>(obj: T, promise: Promise<P>): T & PromiseLike<P> {
    for (const [property, descriptor] of descriptors) {
        Reflect.defineProperty(obj, property, {
            ...descriptor,
            value: (descriptor.value as (...args: any[]) => any).bind(promise),
        });
    }
    return obj as T & PromiseLike<P>;
}

/**
 * Restore a property to an object
 * @param obj - the object to restore a property to
 * @param key - the property key
 * @param descriptor - optional property descriptor, if not provided, property will be deleted
 */
export function restoreProperty<T extends object, K extends keyof T>(obj: T, key: K, descriptor?: PropertyDescriptor) {
    if (descriptor) {
        Object.defineProperty(obj, key, descriptor);
    } else if (Object.hasOwn(obj, key)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[key];
    }
}