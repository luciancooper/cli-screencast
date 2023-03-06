import { CodePointRange, GraphemeSet } from '@src/fonts/range';

/**
 * Shuffle the elements in an array of numbers or the characters in an input string
 */
function shuffle<T extends string | number[]>(input: T): T {
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
    return (input === array ? array : array.map((i) => input[i]).join('')) as T;
}

describe('CodePointRange', () => {
    describe('from static constructor', () => {
        test('empty input', () => {
            expect(CodePointRange.from([]).empty()).toBe(true);
        });

        test('unsorted code points', () => {
            const cp = shuffle([1, 2, 3, 4, 6, 7, 8, 10, 11, 12]);
            expect(CodePointRange.from(cp).ranges).toEqual([[1, 5], [6, 9], [10, 13]]);
        });

        test('unsorted code points with duplicates', () => {
            const cp = shuffle([1, 1, 2, 2, 3, 3, 4, 4, 4, 6, 7, 8, 8]);
            expect(CodePointRange.from(cp).ranges).toEqual([[1, 5], [6, 9]]);
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

        test('contains identical component spans', () => {
            expect(CodePointRange.fromRanges([
                [32, 33], [69, 71], [84, 85], [97, 102], [115, 117], [32, 33], [97, 101],
            ]).ranges).toEqual([[32, 33], [69, 71], [84, 85], [97, 102], [115, 117]]);
        });

        test('one span engulfs all others', () => {
            expect(CodePointRange.fromRanges([[3, 5], [8, 12], [15, 20], [1, 25]]).ranges)
                .toEqual([[1, 25]]);
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
                new CodePointRange([[7, 17], [40, 50]]),
                new CodePointRange([[1, 5], [23, 35]]),
            ).ranges).toEqual([[1, 50]]);
        });
    });

    describe('instances', () => {
        test('iterates over all code points', () => {
            expect([...new CodePointRange([[1, 4], [8, 12]])]).toEqual([1, 2, 3, 8, 9, 10, 11]);
        });

        test('checks if code points are covered', () => {
            const range = new CodePointRange([[5, 15], [20, 30]]);
            expect([0, 5, 10, 14, 15, 17, 19, 20, 29, 30, 35].map((cp) => Number(range.contains(cp))))
                .toEqual([0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0]);
        });

        test('checks if grapheme sequences are covered', () => {
            const graphemes = ['👨‍❤️‍💋‍👨', '👨‍👩‍👧‍👧', '🧑🏾‍🚀', '🦹🏻‍♀️'],
                range = CodePointRange.from([...graphemes.slice(0, 3).join('')].map((c) => c.codePointAt(0)!));
            expect(graphemes.map((c) => range.covers(c))).toEqual([true, true, true, false]);
        });
    });
});

describe('GraphemeSet', () => {
    describe('from static constructor', () => {
        test('empty input', () => {
            expect(GraphemeSet.from('').empty()).toBe(true);
        });

        test('input strings with unique elements', () => {
            expect(GraphemeSet.from(shuffle('abcdfghijk')).string()).toBe('abcdfghijk');
        });

        test('input strings with duplicate elements', () => {
            expect(GraphemeSet.from(shuffle('aaabccdddfgghhhijjjkkk')).string()).toBe('abcdfghijk');
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
            expect(ab.intersect(CodePointRange.from([...a]))).toEqual({ intersection: a, difference: b });
            expect(ab.intersect(CodePointRange.from([...b]))).toEqual({ intersection: b, difference: a });
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