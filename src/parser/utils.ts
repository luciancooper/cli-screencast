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