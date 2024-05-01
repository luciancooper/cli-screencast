import { CodePointRange, GraphemeSet, MeasuredGraphemeSet } from '@src/fonts/range';

/**
 * Shuffle the elements in an array of numbers or the characters in an input string
 */
function shuffle<T extends string | any[]>(input: T): T {
    const n = input.length;
    if (typeof input === 'string') {
        const indexes: number[] = [];
        for (let i = 0; i < n; i += 1) indexes[i] = i;
        return shuffle(indexes).map((i) => input[i]).join('') as T;
    }
    // durstenfeld shuffle
    for (let i = n - 1, j: number; i > 0; i -= 1) {
        j = Math.floor(Math.random() * (i + 1));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        [input[i], input[j]] = [input[j]!, input[i]!];
    }
    return input;
}

describe('CodePointRange', () => {
    describe('from static constructor', () => {
        test('empty input', () => {
            expect(CodePointRange.from([]).empty()).toBe(true);
        });

        test('unsorted code points', () => {
            expect(CodePointRange.from(
                shuffle([[1], [2], [3], [4], [6], [7], [8], [10], [11], [12]]),
            ).ranges).toEqual([[1, 5], [6, 9], [10, 13]]);
        });

        test('unsorted code points with duplicates', () => {
            expect(CodePointRange.from(
                shuffle([[1, 0.5], [1], [2, 0.5], [2], [3], [3], [4], [4], [4], [6, 0.6], [7, 0.6], [8, 0.6], [8]]),
            ).ranges).toEqual([[1, 3, 0.5], [3, 5], [6, 9, 0.6]]);
        });
    });

    describe('fromRanges static constructor', () => {
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
            expect(CodePointRange.fromRanges([[1, 5], [8, 9], [15, 20], [3, 9], [12, 17], [19, 23]]).ranges)
                .toEqual([[1, 9], [12, 23]]);
        });

        test('disjoint input ranges', () => {
            expect(CodePointRange.fromRanges([[5, 9], [13, 17], [1, 3], [9, 11], [17, 20]]).ranges)
                .toEqual([[1, 3], [5, 11], [13, 20]]);
        });

        test('contains identical input ranges', () => {
            expect(CodePointRange.fromRanges([
                [32, 33], [69, 71], [84, 85], [97, 102], [115, 117], [32, 33], [97, 101],
            ]).ranges).toEqual([[32, 33], [69, 71], [84, 85], [97, 102], [115, 117]]);
        });

        test('one range engulfs all others', () => {
            expect(CodePointRange.fromRanges([[3, 5], [8, 12], [15, 20], [1, 25]]).ranges)
                .toEqual([[1, 25]]);
        });

        test('measured ranges partially engulfed by unmeasured ones', () => {
            expect(CodePointRange.fromRanges([
                [1, 5], [2, 5, 0.5], [1, 2, 0.6], [2, 5, 0.5], [1, 5],
            ]).ranges).toEqual([
                [1, 2, 0.6], [2, 5, 0.5],
            ]);
        });

        test('measured ranges fully engulfed by unmeasured ones', () => {
            expect(CodePointRange.fromRanges([
                [3, 5, 0.5], [1, 6], [7, 11], [9, 10, 0.5], [12, 15, 0.4], [13, 14], [17, 19], [16, 20, 0.4],
            ]).ranges).toEqual([
                [1, 3], [3, 5, 0.5], [5, 6], [7, 9], [9, 10, 0.5], [10, 11], [12, 15, 0.4], [16, 20, 0.4],
            ]);
        });

        test('measured ranges fully engulfed by unmeasured ones requiring expansion', () => {
            expect(CodePointRange.fromRanges([
                [3, 5, 0.5], [1, 7],
                [23, 25, 0.5], [21, 27],
                [29, 34], [30, 32, 0.5],
                [43, 45, 0.5], [41, 47],
                [49, 54], [50, 52, 0.5],
                [63, 65, 0.5], [61, 67],
                [69, 74], [70, 72, 0.5],
            ]).ranges).toEqual([
                [1, 3], [3, 5, 0.5], [5, 7],
                [21, 23], [23, 25, 0.5], [25, 27],
                [29, 30], [30, 32, 0.5], [32, 34],
                [41, 43], [43, 45, 0.5], [45, 47],
                [49, 50], [50, 52, 0.5], [52, 54],
                [61, 63], [63, 65, 0.5], [65, 67],
                [69, 70], [70, 72, 0.5], [72, 74],
            ]);
        });

        test('measured ranges overlap with unmeasured ones', () => {
            expect(CodePointRange.fromRanges([
                [1, 3, 0.45], [2, 5], [6, 8], [7, 10, 0.5], [12, 16, 0.55], [10, 14], [18, 22], [16, 20, 0.6],
            ]).ranges).toEqual([
                [1, 3, 0.45], [3, 5], [6, 7], [7, 10, 0.5], [10, 12], [12, 16, 0.55], [16, 20, 0.6], [20, 22],
            ]);
        });
    });

    describe('merge static constructor', () => {
        test('handles less than 2 arguments', () => {
            expect(CodePointRange.merge().empty()).toBe(true);
            expect(CodePointRange.merge(new CodePointRange([[1, 20]])).ranges).toEqual([[1, 20]]);
        });

        test('merges disjoint ranges', () => {
            expect(CodePointRange.merge(
                new CodePointRange([[1, 10], [11, 20]]),
                new CodePointRange([[21, 30]]),
                new CodePointRange([[31, 40], [41, 50]]),
            ).ranges).toEqual([[1, 10], [11, 20], [21, 30], [31, 40], [41, 50]]);
        });

        test('merges overlapping ranges', () => {
            expect(CodePointRange.merge(
                new CodePointRange([[5, 10], [15, 25], [35, 45]]),
                new CodePointRange([[7, 17], [40, 50, 0.5]]),
                new CodePointRange([[1, 5], [23, 35]]),
            ).ranges).toEqual([[1, 40], [40, 50, 0.5]]);
        });
    });

    describe('instances', () => {
        test('checks if code points are covered', () => {
            const range = new CodePointRange([[5, 15], [20, 30]]);
            expect([0, 5, 10, 14, 15, 17, 19, 20, 29, 30, 35].map((cp) => (range.contains(cp) === false ? 0 : 1)))
                .toEqual([0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0]);
        });

        test('checks if grapheme sequences are covered', () => {
            const graphemes = ['👨‍❤️‍💋‍👨', '👨‍👩‍👧‍👧', '🧑🏾‍🚀', '🦹🏻‍♀️'],
                range = CodePointRange.from([...graphemes.slice(0, 3).join('')].map((c) => [c.codePointAt(0)!]));
            expect(graphemes.map((c) => range.covers(c))).toEqual([undefined, undefined, undefined, false]);
        });
    });
});

describe('GraphemeSet', () => {
    describe('from static constructor', () => {
        test('empty input', () => {
            expect(GraphemeSet.from('').empty()).toBe(true);
            expect(GraphemeSet.from('')).toHaveLength(0);
        });

        test('input strings with unique elements', () => {
            expect(GraphemeSet.from(shuffle('abcdfghijk')).string()).toBe('abcdfghijk');
            expect(GraphemeSet.from(shuffle([...'abcdfghijk'])).string()).toBe('abcdfghijk');
        });

        test('input strings with duplicate elements', () => {
            expect(GraphemeSet.from(shuffle('aaabccdddfgghhhijjjkkk')).string()).toBe('abcdfghijk');
            expect(GraphemeSet.from(shuffle([...'aaabccdddfgghhhijjjkkk'])).string()).toBe('abcdfghijk');
        });
    });

    describe('merge static constructor', () => {
        test('handles less than 2 arguments', () => {
            expect(GraphemeSet.merge().empty()).toBe(true);
            expect(GraphemeSet.merge(new GraphemeSet(['a', 'b', 'c'])).string()).toBe('abc');
        });

        test('merges disjoint sets', () => {
            const sets = ['abcdefhijkl', 'nopq', 'stuvxyz'].map((r) => GraphemeSet.from(r));
            expect(GraphemeSet.merge(...sets).string()).toBe('abcdefhijklnopqstuvxyz');
        });

        test('merges overlapping sets', () => {
            const sets = ['efghilmnopqtuvw', 'ghijklmvwxy', 'abcdpqrs'].map((r) => GraphemeSet.from(r));
            expect(GraphemeSet.merge(...sets).string()).toBe('abcdefghijklmnopqrstuvwxy');
        });
    });

    describe('contains', () => {
        test('checks if a set contains a char', () => {
            const set = GraphemeSet.from('abcd');
            expect(set.contains('a')).toBe(true);
            expect(set.contains('x')).toBe(false);
        });

        test('returns false if set is empty', () => {
            const set = new GraphemeSet();
            expect(set.contains('a')).toBe(false);
        });
    });

    describe('intersect', () => {
        const expectedIntersect = (a: string, b: string): ReturnType<GraphemeSet['intersect']> => ({
            intersection: GraphemeSet.from(a),
            difference: GraphemeSet.from(b),
        });

        test('between disjoint sets', () => {
            const [a, b] = [GraphemeSet.from('efghmnop'), GraphemeSet.from('abijqrs')];
            expect(a.intersect(b)).toEqual({ intersection: { chars: [] }, difference: a });
            expect(b.intersect(a)).toEqual({ intersection: { chars: [] }, difference: b });
        });

        test('between overlapping sets', () => {
            const [a, b] = [GraphemeSet.from('abcdhopqrs'), GraphemeSet.from('cdefghlmnopstuv')];
            expect(a.intersect(b)).toEqual(expectedIntersect('cdhops', 'abqr'));
            expect(b.intersect(a)).toEqual(expectedIntersect('cdhops', 'efglmntuv'));
        });

        test('between a subset and superset', () => {
            const [a, b] = [GraphemeSet.from('cdhijkopqrs'), GraphemeSet.from('abcdefghijklmnopqrstuvwx')];
            expect(a.intersect(b)).toEqual({ intersection: a, difference: { chars: [] } });
            expect(b.intersect(a)).toEqual(expectedIntersect('cdhijkopqrs', 'abefglmntuvwx'));
        });

        test('between empty sets', () => {
            const [e, a] = [new GraphemeSet(), GraphemeSet.from('abcde')];
            expect(a.intersect(e)).toEqual({ intersection: { chars: [] }, difference: a });
            expect(e.intersect(a)).toEqual({ intersection: { chars: [] }, difference: { chars: [] } });
            expect(e.intersect(e)).toEqual({ intersection: { chars: [] }, difference: { chars: [] } });
        });

        test('with a range of codepoints', () => {
            const [a, b] = [GraphemeSet.from('👩🏾‍🦰🧔🏻‍♂️'), GraphemeSet.from('👩🏼‍🤝‍👨🏻🦸🏽‍♂️')],
                ab = a.union(b);
            expect(ab.intersect(CodePointRange.from([...a].map((v) => [v]))))
                .toEqual({ intersection: a, difference: b });
            expect(ab.intersect(CodePointRange.from([...b].map((v) => [v]))))
                .toEqual({ intersection: b, difference: a });
        });
    });

    describe('measuredIntersection', () => {
        const letters = CodePointRange.fromRanges([[65, 91, 0.6], [97, 123, 0.5], [0x23E9, 0x23ED, 1.1]]);

        test('empty set', () => {
            expect(new GraphemeSet().measuredIntersection(letters))
                .toEqual({ intersection: { chars: [] }, difference: { chars: [] } });
        });

        test('full overlap', () => {
            expect(GraphemeSet.from('ABCabc').measuredIntersection(letters)).toEqual({
                intersection: { chars: [['A', 0.6], ['B', 0.6], ['C', 0.6], ['a', 0.5], ['b', 0.5], ['c', 0.5]] },
                difference: { chars: [] },
            });
        });

        test('no overlap', () => {
            expect(GraphemeSet.from('123').measuredIntersection(letters))
                .toEqual({ intersection: { chars: [] }, difference: { chars: ['1', '2', '3'] } });
        });

        test('partial overlap', () => {
            expect(GraphemeSet.from('123ABCabc').measuredIntersection(letters)).toEqual({
                intersection: { chars: [['A', 0.6], ['B', 0.6], ['C', 0.6], ['a', 0.5], ['b', 0.5], ['c', 0.5]] },
                difference: { chars: ['1', '2', '3'] },
            });
        });

        test('full width characters', () => {
            expect(GraphemeSet.from('⏩⏪⏫⏬').measuredIntersection(letters)).toEqual({
                intersection: { chars: [['⏩', 0.55], ['⏪', 0.55], ['⏫', 0.55], ['⏬', 0.55]] },
                difference: { chars: [] },
            });
        });
    });

    describe('union', () => {
        test('with another char set', () => {
            expect(GraphemeSet.from('acegij').union(GraphemeSet.from('bdefhi')).string()).toBe('abcdefghij');
        });

        test('with a string', () => {
            expect((GraphemeSet.from('abcd').union('efdc')).string()).toBe('abcdef');
        });

        test('with an empty set', () => {
            const a = GraphemeSet.from('abcde');
            expect(a.union(new GraphemeSet())).toEqual(a);
            expect(a.union('')).toEqual(a);
        });
    });
});

describe('MeasuredGraphemeSet', () => {
    test('empty set', () => {
        expect(new MeasuredGraphemeSet().empty()).toBe(true);
    });

    test('union with another set', () => {
        const a = new MeasuredGraphemeSet([['a', 0.5], ['c', 0.5]]),
            b = new MeasuredGraphemeSet([['a'], ['b', 0.5], ['d', 0.5]]);
        expect(a.union(b)).toEqual(new MeasuredGraphemeSet([['a', 0.5], ['b', 0.5], ['c', 0.5], ['d', 0.5]]));
    });

    test('iterates over code points', () => {
        expect([...new MeasuredGraphemeSet([['a', 0.5], ['b', 0.5], ['c', 0.5], ['d', 0.5]])])
            .toEqual([97, 98, 99, 100]);
    });

    test('produces width distribution', () => {
        expect(new MeasuredGraphemeSet([['a', undefined], ['b', 0.5], ['c', 0.6], ['d', 0.5]]).widthDistribution())
            .toEqual([[1, undefined], [2, 0.5], [1, 0.6]]);
    });
});