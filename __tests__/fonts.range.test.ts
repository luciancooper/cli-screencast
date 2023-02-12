import CodePointRange from '@src/fonts/range';

/**
 * Shuffle the elements in an array of numbers or the characters in an input string
 */
function shuffle(input: string | number[]) {
    let array: number[];
    const n = input.length;
    if (typeof input === 'string') {
        array = [];
        for (let i = 0; i < n; i += 1) array[i] = i;
    } else array = input;
    // durstenfeld shuffle
    for (let i = n - 1, j: number; i > 0; i -= 1) {
        j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return input === array ? array : array.map((i) => input[i]).join('');
}

describe('static constructors', () => {
    describe('CodePointRange.from', () => {
        test('empty input', () => {
            expect(CodePointRange.from([]).empty()).toBe(true);
            expect(CodePointRange.from('').empty()).toBe(true);
        });

        test('unsorted code points', () => {
            const cp = shuffle([1, 2, 3, 4, 6, 7, 8, 10, 11, 12]);
            expect(CodePointRange.from(cp).ranges).toEqual([[1, 5], [6, 9], [10, 13]]);
        });

        test('unsorted code points with duplicates', () => {
            const cp = shuffle([1, 1, 2, 2, 3, 3, 4, 4, 4, 6, 7, 8, 8]);
            expect(CodePointRange.from(cp).ranges).toEqual([[1, 5], [6, 9]]);
        });

        test('handles input strings', () => {
            expect(CodePointRange.from(shuffle('abcdfghijk')).ranges).toEqual([[97, 101], [102, 108]]);
        });

        test('handles input strings with duplicates', () => {
            expect(CodePointRange.from(shuffle('aaabccdddfgghhhijjjkkk')).ranges).toEqual([[97, 101], [102, 108]]);
        });
    });

    describe('CodePointRange.fromRanges', () => {
        test('empty input', () => {
            expect(CodePointRange.fromRanges([]).empty()).toBe(true);
        });

        test('unsorted input ranges', () => {
            expect(CodePointRange.fromRanges([[11, 20], [21, 30], [1, 10]]).ranges)
                .toEqual([[1, 10], [11, 20], [21, 30]]);
        });

        test('overlapping input ranges', () => {
            expect(CodePointRange.fromRanges([[11, 25], [21, 30], [1, 10]]).ranges)
                .toEqual([[1, 10], [11, 30]]);
        });
    });

    describe('CodePointRange.mergeRanges', () => {
        test('handles less than 2 arguments', () => {
            expect(CodePointRange.mergeRanges().empty()).toBe(true);
            expect(CodePointRange.mergeRanges(new CodePointRange([[1, 20]])).ranges).toEqual([[1, 20]]);
        });

        test('merges disjoint ranges', () => {
            expect(CodePointRange.mergeRanges(
                new CodePointRange([[1, 10], [11, 20]]),
                new CodePointRange([[21, 30]]),
                new CodePointRange([[31, 40], [41, 50]]),
            ).ranges).toEqual([[1, 10], [11, 20], [21, 30], [31, 40], [41, 50]]);
        });

        test('merges overlapping ranges', () => {
            expect(CodePointRange.mergeRanges(
                new CodePointRange([[5, 10], [15, 25], [35, 45]]),
                new CodePointRange([[7, 17], [40, 50]]),
                new CodePointRange([[1, 5], [23, 35]]),
            ).ranges).toEqual([[1, 50]]);
        });
    });
});

describe('instance methods', () => {
    test('length', () => {
        expect(new CodePointRange([[5, 15], [20, 30]])).toHaveLength(20);
        expect(new CodePointRange()).toHaveLength(0);
    });

    test('chars', () => {
        expect(CodePointRange.from('abc').chars()).toBe('abc');
    });

    describe('intersect', () => {
        const intersect = (a: CodePointRange, b: CodePointRange) => {
                const { intersection, difference } = a.intersect(b);
                return { intersection: intersection.ranges, difference: difference.ranges };
            },
            expectedIntersect = (a: number[], b: number[]) => ({
                intersection: CodePointRange.from(a.filter((v) => b.includes(v))).ranges,
                difference: CodePointRange.from(a.filter((v) => !b.includes(v))).ranges,
            });

        test('empty ranges', () => {
            const e = new CodePointRange(),
                a = new CodePointRange([[1, 10]]);
            expect(intersect(a, e)).toEqual({ intersection: [], difference: a.ranges });
            expect(intersect(e, a)).toEqual({ intersection: [], difference: [] });
            expect(intersect(e, e)).toEqual({ intersection: [], difference: [] });
        });

        test('disjoint ranges', () => {
            const a = new CodePointRange([[5, 9], [13, 17]]),
                b = new CodePointRange([[1, 3], [9, 11], [17, 20]]);
            expect(intersect(a, b)).toEqual({ intersection: [], difference: a.ranges });
            expect(intersect(b, a)).toEqual({ intersection: [], difference: b.ranges });
        });

        test('overlapping ranges', () => {
            const a = new CodePointRange([[1, 5], [8, 9], [15, 20]]),
                b = new CodePointRange([[3, 9], [12, 17], [19, 23]]);
            expect(intersect(a, b)).toEqual(expectedIntersect([...a], [...b]));
            expect(intersect(b, a)).toEqual(expectedIntersect([...b], [...a]));
        });

        test('subset range', () => {
            const a = new CodePointRange([[3, 5], [8, 12], [15, 20]]),
                b = new CodePointRange([[1, 25]]);
            expect(intersect(a, b)).toEqual({ intersection: a.ranges, difference: [] });
            expect(intersect(b, a)).toEqual(expectedIntersect([...b], [...a]));
        });
    });

    describe('union', () => {
        test('empty ranges', () => {
            const e = new CodePointRange(),
                a = new CodePointRange([[1, 10]]);
            expect((a.union(e)).ranges).toEqual(a.ranges);
            expect((e.union(a)).ranges).toEqual(a.ranges);
            expect((e.union(e)).ranges).toEqual(e.ranges);
        });

        test('disjoint ranges', () => {
            const a = new CodePointRange([[5, 9], [13, 17]]),
                b = new CodePointRange([[1, 3], [9, 11], [17, 20]]),
                u = CodePointRange.from([...new Set([...a, ...b])]).ranges;
            expect((a.union(b)).ranges).toEqual(u);
            expect((b.union(a)).ranges).toEqual(u);
        });

        test('overlapping ranges', () => {
            const a = new CodePointRange([[1, 5], [8, 9], [15, 20]]),
                b = new CodePointRange([[3, 9], [12, 17], [19, 23]]),
                u = CodePointRange.from([...new Set([...a, ...b])]).ranges;
            expect((a.union(b)).ranges).toEqual(u);
        });

        test('subset range', () => {
            const a = new CodePointRange([[3, 5], [8, 12], [15, 20]]),
                b = new CodePointRange([[1, 25]]);
            expect((a.union(b)).ranges).toEqual(b.ranges);
            expect((b.union(a)).ranges).toEqual(b.ranges);
        });
    });
});