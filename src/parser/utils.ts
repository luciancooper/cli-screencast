/**
 * Deep clone an object
 * @param obj - object to clone
 * @returns cloned object
 */
export function clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Generator function to split a string into chunks matched by a regular expression,
 * including the chunks between matches
 * @param regex - regular expression to match chunks
 * @param string - string to process
 */
export function* regexChunks(regex: RegExp, string: string): Generator<readonly [str: string, match: boolean]> {
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