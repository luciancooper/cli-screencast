import { splitChars, charWidths } from 'tty-strings';

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

type Tuple<T> = [T, (number | undefined)?];

function sortTuplesTopDown<T extends string | number>(b: Tuple<T>[], a: Tuple<T>[], l: number, r: number) {
    if (r - l <= 1) return r - l;
    // split the run longer than 1 item into halves
    const m = (l + r) >> 1,
        // recursively sort left run from array a[] into b[]
        n1 = sortTuplesTopDown(a, b, l, m),
        // recursively sort right run from array a[] into b[]
        n2 = sortTuplesTopDown(a, b, m, r);
    // merge the resulting runs from array b[] into a[]
    let [k, i, j] = [l, 0, 0];
    for (; i < n1 && j < n2; k += 1) {
        const dx = b[l + i]![0] < b[m + j]![0] ? -1 : b[l + i]![0] > b[m + j]![0] ? 1 : 0;
        a[k] = dx === 0 ? [b[l + i]![0], b[l + i]![1] ?? b[m + j]![1]] : dx < 0 ? b[l + i]! : b[m + j]!;
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
function mergeSortTuples<T extends string | number>(array: Tuple<T>[]) {
    return array.slice(0, sortTuplesTopDown(array.slice(), array, 0, array.length));
}

type Range = [number, number, (number | undefined)?];

/**
 * Merge sort top down from array b into array a
 */
function sortRangesTopDown(b: Range[], a: Range[], l: number, r: number, lvl = 0) {
    if (r - l <= 1) return r - l;
    // split the run longer than 1 item into halves
    let m = (l + r) >> 1,
        // track the starting length of the array
        len = b.length;
    // recursively sort left run from array a[] into b[]
    const n1 = sortRangesTopDown(a, b, l, m, lvl + 1);
    // check if array has expanded
    if (n1 - (m - l) > 0) {
        const [dx, lx] = [n1 - (m - l), (b.length - len)];
        if (dx - lx > 0) {
            // expand array, copying from a into b
            for (let ex = dx - lx, j = a.length - 1; j >= m + lx; j -= 1) [b[j + ex], a[j + ex]] = [a[j]!, a[j]!];
        }
        m += dx;
        // eslint-disable-next-line no-param-reassign
        r += dx;
    }
    // reset length of the array
    len = b.length;
    // recursively sort right run from array a[] into b[]
    const n2 = sortRangesTopDown(a, b, m, r, lvl + 1);
    // check if array has expanded
    if (n2 - (r - m) > 0) {
        const [dx, lx] = [n2 - (r - m), b.length - len];
        if (dx - lx > 0) {
            // expand array, copying from a into b
            for (let ex = dx - lx, j = a.length - 1; j >= r + lx; j -= 1) [b[j + ex], a[j + ex]] = [a[j]!, a[j]!];
        }
        // eslint-disable-next-line no-param-reassign
        r += dx;
    }
    // merge the resulting runs from array b[] into a[]
    let [k, i, j, k1, k2, [x1, x2, xv], [y1, y2, yv]] = [l, 0, 0, 0, 0, b[l]!, b[m]!];
    for (; i < n1 && j < n2; i += k1, j += k2) {
        if (k1) [[x1, x2, xv], k1] = [b[l + i]!, 0];
        if (k2) [[y1, y2, yv], k2] = [b[m + j]!, 0];
        if (x2 < y1) {
            // [x1...x2] ... [y1...y2]
            a[k] = [x1, x2, xv];
            k1 = 1;
            k += 1;
        } else if (y2 < x1) {
            // [y1...y2] ... [x1...x2]
            a[k] = [y1, y2, yv];
            k2 = 1;
            k += 1;
        } else if (y2 < x2) {
            // [x1 ... [y1 ... y2] ... x2] / [y1 ... [x1 ... y2] ... x2] / [(x1,y1) ... y2] ... x2]
            if (xv === yv) {
                [x1, k2] = [Math.min(x1, y1), 1];
            } else if (x1 < y1) {
                // [x1 ... [y1 ... y2] ... x2]
                if (xv === undefined) {
                    [a[k], x1] = [[x1, y1, xv], y1];
                    k += 1;
                } else k2 = 1;
            } else if (y1 < x1) {
                // [y1 ... [x1 ... y2] ... x2]
                if (yv === undefined) a[k] = [y1, x1, yv];
                else [a[k], x1] = [[y1, y2, yv], y2];
                k += 1;
                k2 = 1;
            } else {
                // [(x1,y1) ... y2] ... x2]
                if (xv === undefined) {
                    [a[k], x1] = [[y1, y2, yv], y2];
                    k += 1;
                }
                k2 = 1;
            }
        } else if (x2 < y2) {
            // [x1 ... [y1 ... x2] ... y2] / [y1 ... [x1 ... x2] ... y2] / [(x1,y1) ... x2] ... y2]
            if (xv === yv) {
                [y1, k1] = [Math.min(x1, y1), 1];
            } else if (y1 < x1) {
                // [y1 ... [x1 ... x2] ... y2]
                if (yv === undefined) {
                    [a[k], y1] = [[y1, x1, yv], x1];
                    k += 1;
                } else k1 = 1;
            } else if (x1 < y1) {
                // [x1 ... [y1 ... x2] ... y2]
                if (xv === undefined) a[k] = [x1, y1, xv];
                else [a[k], y1] = [[x1, x2, xv], x2];
                k += 1;
                k1 = 1;
            } else {
                // [(x1,y1) ... x2] ... y2]
                if (yv === undefined) {
                    [a[k], y1] = [[x1, x2, xv], x2];
                    k += 1;
                }
                k1 = 1;
            }
        } else {
            // [x1 ... [y1 ... (x2,y2)] / [y1 ... [x1 ... (x2,y2)] / [(x1,y1) ... (x2,y2)]
            if (xv === yv) {
                a[k] = [Math.min(x1, y1), x2, xv];
            } else if (x1 < y1) {
                // [x1 ... [y1 ... (x2,y2)]
                if (xv === undefined) {
                    [a[k], x1] = [[x1, y1, xv], y1];
                    k += 1;
                }
                a[k] = [x1, x2, xv ?? yv];
            } else if (y1 < x1) {
                // [y1 ... [x1 ... (x2,y2)]
                if (yv === undefined) {
                    [a[k], y1] = [[y1, x1, yv], x1];
                    k += 1;
                }
                a[k] = [y1, y2, yv ?? xv];
            } else {
                // [(x1,y1) ... (x2,y2)]
                a[k] = [x1, x2, xv ?? yv];
            }
            k += 1;
            [k1, k2] = [1, 1];
        }
    }
    if (!k1) [a[k], k] = [[x1, x2, xv], k + 1];
    if (!k2) [a[k], k] = [[y1, y2, yv], k + 1];
    for (i += k1 ^ 1; i < n1; i += 1, k += 1) a[k] = b[l + i]!;
    for (j += k2 ^ 1; j < n2; j += 1, k += 1) a[k] = b[m + j]!;
    return k - l;
}

/**
 * Top-down implementation of merge sort that merges overlapping ranges
 */
function mergeSortRanges(array: Range[]) {
    return array.slice(0, sortRangesTopDown(array.slice(), array, 0, array.length));
}

export class CodePointRange {
    constructor(public ranges: Range[] = []) {}

    static from(input: Tuple<number>[]): CodePointRange {
        // sort input code points
        const points = mergeSortTuples(input);
        if (!points.length) return new this();
        const ranges: Range[] = [];
        let [i, n] = [0, points.length];
        for (let j = 0; j < n - 1; j += 1) {
            if ((points[j + 1]![0] - points[j]![0]) === 1 && points[j + 1]![1] === points[j]![1]) continue;
            ranges.push([points[i]![0], points[j]![0] + 1, points[i]![1]]);
            i = j + 1;
        }
        ranges.push([points[i]![0], points[n - 1]![0] + 1, points[i]![1]]);
        return new this(ranges);
    }

    static fromRanges(ranges: Range[]) {
        return new this(ranges.length <= 1 ? ranges : mergeSortRanges(ranges));
    }

    static merge(...input: CodePointRange[]) {
        return input.length >= 2 ? this.fromRanges(input.flatMap((r) => r.ranges))
            : new this(input[0]?.ranges ?? []);
    }

    empty(): boolean {
        return this.ranges.length === 0;
    }

    /**
     * Checks if a codepoint is in this code point range
     */
    contains(code: number): false | number | undefined {
        // use binary search
        let [i, j] = [0, this.ranges.length - 1];
        while (i <= j) {
            const m = Math.floor((i + j) / 2),
                [r1, r2, val] = this.ranges[m]!;
            if (code < r1) j = m - 1;
            else if (code >= r2) i = m + 1;
            else return val;
        }
        return false;
    }

    /**
     * Returns width if the code point range contains each code point in the string
     */
    covers(string: string): false | number | undefined {
        let w: number | undefined;
        for (const c of string) {
            const v = this.contains(c.codePointAt(0)!);
            if (v === false) return false;
            w = w === undefined ? v : Math.max(w, v ?? 0);
        }
        return w;
    }
}

export class MeasuredGraphemeSet implements Iterable<number> {
    constructor(public chars: Tuple<string>[] = []) {}

    empty(): boolean {
        return this.chars.length === 0;
    }

    /**
     * Iterate over the code points of each character in the set
     */
    * [Symbol.iterator](): IterableIterator<number> {
        for (const [char] of this.chars) {
            for (const c of char) {
                yield c.codePointAt(0)!;
            }
        }
    }

    union(input: MeasuredGraphemeSet): MeasuredGraphemeSet {
        const chars = this.chars.concat(input.chars);
        return new MeasuredGraphemeSet(mergeSortTuples(chars));
    }

    widthDistribution(): [number, number | undefined][] {
        const map = new Map<number | undefined, number>();
        for (const [, v] of this.chars) map.set(v, (map.get(v) ?? 0) + 1);
        return [...map.entries()].map(([v, count]) => [count, v]);
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

    get length(): number {
        return this.chars.length;
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
                (collection.covers(char) !== false ? intersection : difference).push(char);
            }
        }
        return {
            intersection: new GraphemeSet(intersection),
            difference: new GraphemeSet(difference),
        };
    }

    measuredIntersection(range: CodePointRange): { intersection: MeasuredGraphemeSet, difference: GraphemeSet } {
        // stop if either collection is empty
        if (this.empty() || range.empty()) {
            return { intersection: new MeasuredGraphemeSet(), difference: this };
        }
        // create intersection / difference arrays
        const intersection: Tuple<string>[] = [],
            difference: string[] = [];
        // handle instersection with a set of code point ranges
        for (const [char, width] of charWidths(this.string())) {
            const covered = range.covers(char);
            if (covered === false) difference.push(char);
            else intersection.push([char, covered !== undefined ? covered / (width || 1) : covered]);
        }
        return {
            intersection: new MeasuredGraphemeSet(intersection),
            difference: new GraphemeSet(difference),
        };
    }
}