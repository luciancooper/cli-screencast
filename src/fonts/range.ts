import { splitChars } from 'tty-strings';

function sortTopDown<T extends string | number>(b: T[], a: T[], l: number, r: number): number {
    if (r - l <= 1) return r - l;
    // split the run longer than 1 item into halves
    const m = (l + r) >> 1,
        // recursively sort left run from array a[] into b[]
        n1 = sortTopDown(a, b, l, m),
        // recursively sort right run from array a[] into b[]
        n2 = sortTopDown(a, b, m, r);
    // merge the resulting runs from array b[] into a[]
    let [k, i, j] = [l, 0, 0];
    for (; i < n1 && j < n2; k += 1) {
        const dx = b[l + i]! < b[m + j]! ? -1 : b[l + i]! > b[m + j]! ? 1 : 0;
        a[k] = dx <= 0 ? b[l + i]! : b[m + j]!;
        i += dx <= 0 ? 1 : 0;
        j += dx >= 0 ? 1 : 0;
    }
    for (; i < n1; i += 1, k += 1) a[k] = b[l + i]!;
    for (; j < n2; j += 1, k += 1) a[k] = b[m + j]!;
    return k - l;
}

/**
 * Top-down implementation of merge sort that removes duplicate array elements
 */
function mergeSort<T extends string | number>(array: T[]) {
    return array.slice(0, sortTopDown(array.slice(), array, 0, array.length));
}

function sortRangesTopDown(b: [number, number][], a: [number, number][], l: number, r: number): number {
    if (r - l <= 1) return r - l;
    // split the run longer than 1 item into halves
    const m = (l + r) >> 1,
        // recursively sort left run from array a[] into b[]
        n1 = sortRangesTopDown(a, b, l, m),
        // recursively sort right run from array a[] into b[]
        n2 = sortRangesTopDown(a, b, m, r);
    // merge the resulting runs from array b[] into a[]
    let [k, i, j, k1, k2, [x1, x2], [y1, y2]] = [l, 0, 0, 0, 0, b[l]!, b[m]!];
    for (; i < n1 && j < n2; i += k1, j += k2) {
        if (k1) [[x1, x2], k1] = [b[l + i]!, 0];
        if (k2) [[y1, y2], k2] = [b[m + j]!, 0];
        if (x2 < y1) {
            // [x1...x2] ... [y1...y2]
            a[k] = [x1, x2];
            k1 = 1;
            k += 1;
        } else if (y2 < x1) {
            // [y1...y2] ... [y1...y2]
            a[k] = [y1, y2];
            k2 = 1;
            k += 1;
        } else if (y2 < x2) {
            // [x1 ... [y1 ... y2] ... x2] / [y1 ... [x1 ... y2] ... x2]
            [x1, k2] = [Math.min(x1, y1), 1];
        } else if (x2 < y2) {
            // [x1 ... [y1 ... x2] ... y2] / [y1 ... [x1 ... x2] ... y2]
            [y1, k1] = [Math.min(x1, y1), 1];
        } else {
            // [x1 ... [y1 ... (x2,y2)] / [y1 ... [x1 ... (x2,y2)]
            a[k] = [Math.min(x1, y1), x2];
            [k1, k2] = [1, 1];
            k += 1;
        }
    }
    if (!k1) [a[k], k] = [[x1, x2], k + 1];
    if (!k2) [a[k], k] = [[y1, y2], k + 1];
    for (i += k1 ^ 1; i < n1; i += 1, k += 1) a[k] = b[l + i]!;
    for (j += k2 ^ 1; j < n2; j += 1, k += 1) a[k] = b[m + j]!;
    return k - l;
}

/**
 * Top-down implementation of merge sort that merges overlapping ranges
 */
function mergeSortRanges(array: [number, number][]) {
    return array.slice(0, sortRangesTopDown(array.slice(), array, 0, array.length));
}

export class CodePointRange implements Iterable<number> {
    constructor(public ranges: [number, number][] = []) {}

    static from(input: number[]): CodePointRange {
        // sort input code points
        const points = mergeSort(input);
        if (!points.length) return new CodePointRange();
        const ranges: [number, number][] = [];
        let [i, n] = [0, points.length];
        for (let j = 0; j < n - 1; j += 1) {
            if ((points[j + 1]! - points[j]!) === 1) continue;
            ranges.push([points[i]!, points[j]! + 1]);
            i = j + 1;
        }
        ranges.push([points[i]!, points[n - 1]! + 1]);
        return new CodePointRange(ranges);
    }

    static fromRanges(ranges: [number, number][]): CodePointRange {
        return new CodePointRange(ranges.length <= 1 ? ranges : mergeSortRanges(ranges));
    }

    static merge(...input: CodePointRange[]): CodePointRange {
        return input.length >= 2 ? this.fromRanges(input.flatMap((r) => r.ranges))
            : input.length === 1 ? input[0]! : new CodePointRange();
    }

    * [Symbol.iterator](): IterableIterator<number> {
        for (const [i, j] of this.ranges) {
            for (let cp = i; cp < j; cp += 1) yield cp;
        }
    }

    empty(): boolean {
        return this.ranges.length === 0;
    }

    /**
     * Checks if a codepoint is in this code point range
     */
    contains(code: number): boolean {
        // use binary search
        let [i, j] = [0, this.ranges.length - 1];
        while (i <= j) {
            const m = Math.floor((i + j) / 2),
                [r1, r2] = this.ranges[m]!;
            if (code < r1) j = m - 1;
            else if (code >= r2) i = m + 1;
            else return true;
        }
        return false;
    }

    /**
     * Returns true if the code point range contains each code point in the string
     */
    covers(string: string): boolean {
        for (const c of string) {
            if (!this.contains(c.codePointAt(0)!)) return false;
        }
        return true;
    }
}

export class GraphemeSet implements Iterable<number> {
    constructor(public chars: string[] = []) {}

    static from(str: string | string[]): GraphemeSet {
        return new GraphemeSet(mergeSort((typeof str === 'string') ? [...splitChars(str)] : str));
    }

    static merge(...input: GraphemeSet[]): GraphemeSet {
        return input.length >= 2 ? new GraphemeSet(mergeSort(input.flatMap((c) => c.chars)))
            : input.length === 1 ? input[0]! : new GraphemeSet();
    }

    empty(): boolean {
        return this.chars.length === 0;
    }

    string(): string {
        return this.chars.join('');
    }

    /**
     * Iterate over the code points of each character in the set
     */
    * [Symbol.iterator](): IterableIterator<number> {
        for (const char of this.chars) {
            for (const c of char) {
                yield c.codePointAt(0)!;
            }
        }
    }

    contains(char: string): boolean {
        let [i, j] = [0, this.chars.length - 1];
        while (i <= j) {
            const m = Math.floor((i + j) / 2);
            if (char < this.chars[m]!) j = m - 1;
            else if (char > this.chars[m]!) i = m + 1;
            else return true;
        }
        return false;
    }

    union(input: string | GraphemeSet): GraphemeSet {
        const chars = this.chars.concat((typeof input === 'string') ? [...splitChars(input)] : input.chars);
        return new GraphemeSet(mergeSort(chars));
    }

    intersect(collection: GraphemeSet | CodePointRange): { intersection: GraphemeSet, difference: GraphemeSet } {
        // stop if either collection is empty
        if (this.empty() || collection.empty()) {
            return { intersection: new GraphemeSet(), difference: this };
        }
        // create intersection / difference arrays
        const intersection: string[] = [],
            difference: string[] = [];
        if (collection instanceof GraphemeSet) {
            // handle instersection with another char set
            let [i, n] = [0, this.chars.length];
            for (let j = 0, m = collection.chars.length; i < n && j < m;) {
                const c1 = this.chars[i]!,
                    c2 = collection.chars[j]!;
                if (c1 === c2) {
                    intersection.push(c1);
                    i += 1;
                    j += 1;
                } else if (c1 < c2) {
                    difference.push(c1);
                    i += 1;
                } else j += 1;
            }
            for (; i < n; i += 1) difference.push(this.chars[i]!);
        } else {
            // handle instersection with a set of code point ranges
            for (const char of this.chars) {
                (collection.covers(char) ? intersection : difference).push(char);
            }
        }
        return {
            intersection: new GraphemeSet(intersection),
            difference: new GraphemeSet(difference),
        };
    }
}