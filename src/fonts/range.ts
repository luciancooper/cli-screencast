export default class CodePointRange implements Iterable<number> {
    constructor(public ranges: [number, number][] = []) {}

    /**
     * Quicksort implementation to sort code point ranges
     */
    private static sort(array: number[], left = 0, right = array.length - 1) {
        if (left >= right) return array;
        // partition
        const piv = array[Math.floor((left + right) / 2)]!;
        // left & right pointer
        let [i, j] = [left, right];
        while (i <= j) {
            for (; array[i]! < piv; i += 1);
            for (; array[j]! > piv; j -= 1);
            if (i <= j) {
                // swapping two elements
                [array[i], array[j]] = [array[j]!, array[i]!];
                i += 1;
                j -= 1;
            }
        }
        // more elements on the left side of the pivot
        if (left < i - 1) this.sort(array, left, i - 1);
        // more elements on the right side of the pivot
        if (i < right) this.sort(array, i, right);
        return array;
    }

    /**
     * Quicksort implementation to sort code point ranges
     */
    private static sortRanges(ranges: [number, number][], left = 0, right = ranges.length - 1) {
        if (left >= right) return ranges;
        // partition
        const piv = ranges[Math.floor((left + right) / 2)]![0];
        // left & right pointer
        let [i, j] = [left, right];
        while (i <= j) {
            for (; ranges[i]![0] < piv; i += 1);
            for (; ranges[j]![0] > piv; j -= 1);
            if (i <= j) {
                // swapping two elements
                [ranges[i], ranges[j]] = [ranges[j]!, ranges[i]!];
                i += 1;
                j -= 1;
            }
        }
        // more elements on the left side of the pivot
        if (left < i - 1) this.sortRanges(ranges, left, i - 1);
        // more elements on the right side of the pivot
        if (i < right) this.sortRanges(ranges, i, right);
        return ranges;
    }

    /**
     * Create a code point range from a string or array of code points
     */
    static from(input: string | number[]): CodePointRange {
        const points = this.sort((typeof input === 'string') ? [...input].map((c) => c.codePointAt(0)!) : input);
        if (!points.length) return new CodePointRange();
        const ranges: [number, number][] = [];
        let [a, b = a] = [points[0]!] as [number];
        for (let i = 1, n = points.length; i < n; i += 1) {
            const cp = points[i]!;
            if (cp - b > 1) {
                ranges.push([a, b + 1]);
                [a, b] = [cp, cp];
            } else b = cp;
        }
        ranges.push([a, b + 1]);
        return new CodePointRange(ranges);
    }

    static fromRanges(input: [number, number][]): CodePointRange {
        if (input.length <= 1) return new CodePointRange(input);
        // sort the input ranges
        const ranges = this.sortRanges(input);
        // merge any adjacent / overlapping ranges
        let [a1, a2] = ranges[0]!;
        const merged: [number, number][] = [];
        for (let i = 1, n = ranges.length; i < n; i += 1) {
            const [b1, b2] = ranges[i]!;
            if (b1 - a2 > 0) {
                merged.push([a1, a2]);
                [a1, a2] = [b1, b2];
            } else a2 = Math.max(a2, b2);
        }
        merged.push([a1, a2]);
        return new CodePointRange(merged);
    }

    static mergeRanges(...input: CodePointRange[]): CodePointRange {
        return input.length >= 2 ? this.fromRanges(input.flatMap((r) => r.ranges))
            : input.length === 1 ? input[0]! : new CodePointRange();
    }

    * [Symbol.iterator](): IterableIterator<number> {
        for (const [i, j] of this.ranges) {
            for (let cp = i; cp < j; cp += 1) yield cp;
        }
    }

    get length(): number {
        return this.ranges.reduce((count, [i, j]) => count + (j - i), 0);
    }

    empty(): boolean {
        return this.ranges.length === 0;
    }

    chars(): string {
        let str = '';
        for (const cp of this) str += String.fromCodePoint(cp);
        return str;
    }

    intersect(r: CodePointRange): { intersection: CodePointRange, difference: CodePointRange } {
        const [n1, n2] = [this.ranges.length, r.ranges.length];
        // intersection is empty if either range is empty
        if (!n1 || !n2) return { intersection: new CodePointRange(), difference: this };
        const intersection: [number, number][] = [],
            difference: [number, number][] = [];
        let [a1, a2] = this.ranges[0]!,
            [b1, b2] = r.ranges[0]!;
        for (let i1 = 0, i2 = 0, k1 = 0, k2 = 0; i1 < n1 && i2 < n2; i1 += k1, i2 += k2) {
            if (k1) [[a1, a2], k1] = [this.ranges[i1]!, 0];
            if (k2) [[b1, b2], k2] = [r.ranges[i2]!, 0];
            if (a1 < b1) difference.push([a1, Math.min(b1, a2)]);
            // difference
            if (a2 <= b1) {
                // [a1...a2] ... [b1...b2]
                k1 = 1;
                continue;
            }
            if (b2 <= a1) {
                // [b1...b2] ... [a1...a2]
                k2 = 1;
                continue;
            }
            intersection.push([Math.max(a1, b1), Math.min(a2, b2)]);
            if (a2 < b2) {
                // [a1 ... [b1 ... a2] ... b2] / [b1 ... [a1 ... a2] ... b2]
                k1 = 1;
            } else if (b2 < a2) {
                // [a1 ... [b1 ... b2] ... a2] / [b1 ... [a1 ... b2] ... a2]
                [a1, k2] = [b2, 1];
            } else {
                // [a1 ... [b1 ... (a2,b2)] / [b1 ... [a1 ... (a2,b2)]
                [k1, k2] = [1, 1];
            }
        }
        if (a1 >= b2) difference.push([a1, a2]);
        return {
            intersection: new CodePointRange(intersection),
            difference: new CodePointRange(difference),
        };
    }

    union(r: CodePointRange) {
        const [n1, n2] = [this.ranges.length, r.ranges.length];
        // return empty range if either ranges are empty
        if (!n1) return r;
        if (!n2) return this;
        const union: [number, number][] = [];
        let [a1, a2] = this.ranges[0]!,
            [b1, b2] = r.ranges[0]!,
            [k1, k2] = [0, 0];
        for (let i1 = 0, i2 = 0; i1 < n1 && i2 < n2; i1 += k1, i2 += k2) {
            if (k1) [[a1, a2], k1] = [this.ranges[i1]!, 0];
            if (k2) [[b1, b2], k2] = [r.ranges[i2]!, 0];
            if (a2 < b1) {
                // [a1...a2] ... [b1...b2]
                union.push([a1, a2]);
                k1 = 1;
            } else if (b2 < a1) {
                // [b1...b2] ... [a1...a2]
                union.push([b1, b2]);
                k2 = 1;
            } else if (b2 < a2) {
                // [a1 ... [b1 ... b2] ... a2] / [b1 ... [a1 ... b2] ... a2]
                [a1, k2] = [Math.min(a1, b1), 1];
            } else if (a2 < b2) {
                // [a1 ... [b1 ... a2] ... b2] / [b1 ... [a1 ... a2] ... b2]
                [b1, k1] = [Math.min(a1, b1), 1];
            } else {
                // [a1 ... [b1 ... (a2,b2)] / [b1 ... [a1 ... (a2,b2)]
                union.push([Math.min(a1, b1), a2]);
                [k1, k2] = [1, 1];
            }
        }
        if (!k1) union.push([a1, a2]);
        if (!k2) union.push([b1, b2]);
        return new CodePointRange(union);
    }
}