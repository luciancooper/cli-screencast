/* eslint-disable @typescript-eslint/no-namespace */
import { getObjectSubset } from '@jest/expect-utils';

// set default timeout for all tests to 10 seconds
jest.setTimeout(10000);

declare global {
    namespace jest {
        interface Matchers<R> {
            toEachMatchObject: <E extends {} | any[]>(expected: E) => R
            toBeApprox: (expected: number | bigint, threshold?: number) => R
            toContainOccurrences: (match: string | RegExp, count: number) => R
            toBeNumber: () => R
            toBeString: () => R
        }
        interface Expect {
            toBeApprox: (expected: number | bigint, threshold?: number) => number
            toContainOccurrences: (match: string | RegExp, count: number) => string
            toBeNumber: () => number
            toBeUndefined: () => undefined
            toBeString: () => string
        }
        interface InverseAsymmetricMatchers {
            toBeApprox: (expected: number | bigint, threshold?: number) => number
            toContainOccurrences: (match: string | RegExp, count: number) => string
            toBeNumber: () => any
            toBeUndefined: () => any
            toBeString: () => any
        }
    }
}

function matcherHintOptions(this: jest.MatcherContext) {
    return {
        ...this.isNot != null && { isNot: this.isNot },
        ...this.promise != null && { promise: this.promise },
    };
}

expect.extend({
    toEachMatchObject<E extends {} | any[]>(this: jest.MatcherContext, rec: E[], exp: E) {
        if (!Array.isArray(rec) || !rec.length) {
            throw new Error(this.utils.matcherErrorMessage(
                this.utils.matcherHint('toEachMatchObject', undefined, undefined, matcherHintOptions.call(this)),
                `${this.utils.RECEIVED_COLOR('received')} value must be a non-null, non-empty array`,
                this.utils.printWithType('Received', rec, this.utils.printReceived),
            ));
        }
        if (typeof exp !== 'object' || exp === null) {
            throw new Error(this.utils.matcherErrorMessage(
                this.utils.matcherHint('toEachMatchObject', undefined, undefined, matcherHintOptions.call(this)),
                `${this.utils.EXPECTED_COLOR('expected')} value must be a non-null object`,
                this.utils.printWithType('Expected', exp, this.utils.printExpected),
            ));
        }
        let pass = true;
        for (const element of rec) {
            pass = this.equals(element, exp, [
                ...this.customTesters,
                this.utils.iterableEquality,
                this.utils.subsetEquality,
            ]);
            if (!pass) break;
        }
        return {
            pass,
            message: pass
                ? () => (
                    this.utils.matcherHint('toEachMatchObject', undefined, undefined, matcherHintOptions.call(this))
                    + '\n\n'
                    + `Expected: each to not match ${this.utils.printExpected(exp)}`
                    + (this.utils.stringify(new Array(rec.length).fill(exp)) === this.utils.stringify(rec)
                        ? '' : `\nReceived:     ${this.utils.printReceived(rec)}`)
                ) : () => (
                    this.utils.matcherHint('toEachMatchObject', undefined, undefined, matcherHintOptions.call(this))
                    + '\n\n'
                    + this.utils.printDiffOrStringify(
                        new Array(rec.length).fill(exp),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                        rec.map((e) => getObjectSubset(e, exp, this.customTesters)),
                        'Expected',
                        'Received',
                        this.expand !== false,
                    )
                ),
        };
    },

    toBeApprox(act: any, exp: number, threshold?: number) {
        const t = threshold ?? 5,
            pass = typeof act === 'number' && act >= exp - t && act <= exp + t;
        return {
            pass,
            message: () => (
                this.utils.matcherHint('toBeApprox', 'received', 'expected', {
                    ...matcherHintOptions.call(this),
                    secondArgument: 'threshold',
                })
                + `\n\nExpected ${this.utils.printReceived(act)} ${pass ? 'not ' : ''}to be approximately ${
                    this.utils.printExpected(exp)
                } (±${threshold}).`
            ),
        };
    },

    /**
     * Expect a string with to contain the given string or match the given regular expression a certain number of times
     */
    toContainOccurrences(act: any, match: string | RegExp, count: number) {
        const options = { ...matcherHintOptions.call(this), secondArgument: 'count' };
        if (typeof act !== 'string') {
            return {
                pass: false,
                message: () => (
                    this.utils.matcherHint('toContainOccurances', 'received', 'expected', options)
                    + `\n\nExpected type ${this.utils.printExpected('string')} instead got ${
                        this.utils.printReceived(typeof act)
                    }`
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
                this.utils.matcherHint('toContainOccurances', 'received', 'expected', options)
                + `\n\nExpected ${this.utils.printReceived(n)} ${pass ? 'not ' : ''}to be ${
                    this.utils.printExpected(count)
                }`
            ),
        };
    },

    toBeNumber(val: unknown) {
        const pass = typeof val === 'number';
        return {
            pass,
            message: () => (
                this.utils.matcherHint('toBeNumber', 'received', '', matcherHintOptions.call(this))
                + `\n\nExpected value to ${pass ? 'not ' : ''}be a number, received: ${this.utils.printReceived(val)}`
            ),
        };
    },

    toBeUndefined(actual: unknown) {
        const pass = actual === undefined;
        return {
            pass,
            message: () => (
                this.utils.matcherHint('toBeUndefined', undefined, '', matcherHintOptions.call(this))
                + '\n\n'
                + (pass ? 'Expected value to not be undefined'
                    : `Expected value to be undefined, received:  ${this.utils.printReceived(actual)}`)
            ),
        };
    },

    toBeString(val: unknown) {
        const pass = typeof val === 'string' || val instanceof String;
        return {
            pass,
            message: () => (
                this.utils.matcherHint('toBeString', 'received', '', matcherHintOptions.call(this))
                + `\n\nExpected value to ${pass ? 'not ' : ''}be a string, received: ${this.utils.printReceived(val)}`
            ),
        };
    },
});

export {};