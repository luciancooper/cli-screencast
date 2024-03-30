/**
 * Deep clone an object
 * @param obj - object to clone
 * @returns cloned object
 */
export function clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
}

export function* regexChunks(regex: RegExp, string: string): Generator<readonly [string, boolean]> {
    // lower index of the chunk preceding each escape sequence
    let i = 0;
    // call `exec()` until all matches are found
    for (let m = regex.exec(string); m; m = regex.exec(string)) {
        // yield the chunk preceding this match if its length > 0
        if (m.index > i) yield [string.slice(i, m.index), false];
        // yield the match
        yield [m[0], true];
        // set lower string index of the next chunk to be processed
        i = m.index + m[0].length;
    }
    // yield the final chunk of string if its length > 0
    if (i < string.length) yield [string.slice(i), false];
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