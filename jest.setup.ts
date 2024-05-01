/* eslint-disable @typescript-eslint/no-namespace */

// set default timeout for all tests to 10 seconds
jest.setTimeout(10000);

declare global {
    namespace jest {
        interface Matchers<R> {
            toBeApprox: (expected: number | bigint, threshold?: number) => R
            toContainOccurrences: (match: string | RegExp, count: number) => R
            toBeNumber: () => R
        }
        interface Expect {
            toBeApprox: (expected: number | bigint, threshold?: number) => number
            toContainOccurrences: (match: string | RegExp, count: number) => string
            toBeNumber: () => number
            toBeUndefined: () => undefined
        }
        interface InverseAsymmetricMatchers {
            toBeApprox: (expected: number | bigint, threshold?: number) => number
            toContainOccurrences: (match: string | RegExp, count: number) => string
            toBeNumber: () => number
            toBeUndefined: () => undefined
        }
    }
}

expect.extend({
    toBeApprox(act: any, exp: number, threshold?: number) {
        const t = threshold ?? 5,
            pass = typeof act === 'number' && act >= exp - t && act <= exp + t;
        return {
            pass,
            message: () => (
                `${this.utils.matcherHint('toBeApprox', 'received', 'expected', {
                    isNot: pass,
                    secondArgument: 'threshold',
                })}\n\nExpected ${
                    this.utils.printReceived(act)
                } ${pass ? 'not ' : ''}to be approximately ${
                    this.utils.printExpected(exp)
                } (±${threshold}).`
            ),
        };
    },

    /**
     * Expect a string with to contain the given string or match the given regular expression a certain number of times
     */
    toContainOccurrences(act: any, match: string | RegExp, count: number) {
        if (typeof act !== 'string') {
            return {
                pass: false,
                message: () => (
                    `${this.utils.matcherHint('toContainOccurances', 'received', 'expected', {
                        isNot: false,
                        secondArgument: 'count',
                    })}\n\nExpected type ${
                        this.utils.printExpected('string')
                    } instead got ${this.utils.printReceived(typeof act)}`
                ),
            };
        }
        let n = 0;
        if (typeof match !== 'string') {
            for (let str = act, m = match.exec(str); m != null; n += 1, n += 1, m = match.exec(str)) {
                str = str.slice(m.index + m[0].length);
            }
        } else {
            for (let i = act.indexOf(match); i >= 0; n += 1, i = act.indexOf(match, i + match.length));
        }
        const pass = n === count;
        return {
            pass,
            message: () => (
                `${this.utils.matcherHint('toContainOccurances', 'received', 'expected', {
                    isNot: pass,
                    secondArgument: 'count',
                })}\n\nExpected ${
                    this.utils.printReceived(n)
                } ${pass ? 'not ' : ''}to be ${this.utils.printExpected(count)}`
            ),
        };
    },

    toBeNumber(actual: any) {
        const opts = this.isNot != null ? { isNot: this.isNot } : {},
            pass = typeof actual === 'number';
        return {
            pass,
            message: pass ? () => (
                this.utils.matcherHint('toBeNumber', 'received', '', opts)
                + '\n\n'
                + `Expected value to not be a number received: ${this.utils.printReceived(actual)}`
            ) : () => (
                this.utils.matcherHint('toBeNumber', 'received', '', opts)
                + '\n\n'
                + `Expected value to be a number received:  ${this.utils.printReceived(actual)}`
            ),
        };
    },

    toBeUndefined(actual: unknown) {
        const pass = actual === undefined;
        return {
            pass,
            message: () => (
                this.utils.matcherHint('toBeUndefined', undefined, '', this.isNot != null ? { isNot: this.isNot } : {})
                + '\n\n'
                + (pass ? 'Expected value to not be undefined'
                    : `Expected value to be undefined, received:  ${this.utils.printReceived(actual)}`)
            ),
        };
    },
});

export {};