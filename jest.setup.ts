/* eslint-disable @typescript-eslint/no-namespace */
import { getObjectSubset } from '@jest/expect-utils';
import { parse as parseYaml } from 'yaml';

// set default timeout for all tests to 10 seconds
jest.setTimeout(10000);

declare global {
    namespace jest {
        interface Matchers<R> {
            toEachMatchObject: <E extends object>(expected: E) => R
            toBeApprox: (expected: number | bigint, threshold?: number) => R
            toContainOccurrences: (match: string | RegExp, count: number) => R
            toBeJson: <E extends object>(expected?: E) => R
            toBeYaml: <E extends object>(expected?: E) => R
            toBePng: () => R
            toBeSvg: () => R
            toBeNumber: () => R
            toBeString: () => R
        }
        interface Expect {
            toBeApprox: (expected: number | bigint, threshold?: number) => number
            toContainOccurrences: (match: string | RegExp, count: number) => string
            toBeJson: <E extends object>(expected?: E) => string
            toBeYaml: <E extends object>(expected?: E) => string
            toBePng: () => Buffer
            toBeSvg: () => string
            toBeNumber: () => number
            toBeUndefined: () => undefined
            toBeString: () => string
            toBeFalsy: () => any
        }
        interface InverseAsymmetricMatchers {
            toBeApprox: (expected: number | bigint, threshold?: number) => number
            toContainOccurrences: (match: string | RegExp, count: number) => string
            toBeJson: <E extends object>(expected?: E) => any
            toBeYaml: <E extends object>(expected?: E) => any
            toBePng: () => any
            toBeSvg: () => any
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
    toEachMatchObject(this: jest.MatcherContext, rec: unknown[], exp: object) {
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

    toBeJson(this: jest.MatcherContext, rec: unknown, exp?: object) {
        const [matcherName, options] = ['toBeJson', matcherHintOptions.call(this)];
        if (exp !== undefined && (typeof exp !== 'object' || exp === null)) {
            throw new Error(this.utils.matcherErrorMessage(
                this.utils.matcherHint(matcherName, undefined, undefined, options),
                `${this.utils.EXPECTED_COLOR('expected')} value must be a non-null object`,
                this.utils.printWithType('Expected', exp, this.utils.printExpected),
            ));
        }
        let pass = typeof rec === 'string' || rec instanceof String;
        if (!pass) {
            const message = () => (
                this.utils.matcherHint(matcherName, undefined, exp ? undefined : '', options)
                + `\n\nExpected a JSON string, received: ${this.utils.printReceived(rec)}`
            );
            return { pass, message };
        }
        let parsed: any;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            parsed = JSON.parse(rec as string);
        } catch (e: unknown) {
            const message = () => (
                this.utils.matcherHint(matcherName, undefined, exp ? undefined : '', options)
                + `\n\nExpected a valid JSON string, received: ${this.utils.printReceived(rec)}`
                + `\n\nJSON parse error: ${(e as Error).message}`
            );
            return { pass: false, message };
        }
        if (exp !== undefined) {
            pass = this.equals(parsed, exp, [
                ...this.customTesters,
                this.utils.iterableEquality,
                this.utils.subsetEquality,
            ]);
        }
        return {
            pass,
            message: pass
                ? () => (
                    this.utils.matcherHint(matcherName, undefined, exp ? undefined : '', options)
                    + (exp ? (
                        `\n\nExpected not a JSON string matching ${this.utils.printExpected(exp)}`
                        + (this.utils.stringify(exp) === this.utils.stringify(parsed)
                            ? '' : `\nReceived:     ${this.utils.printReceived(parsed)}`)
                    ) : `\n\nExpected not a JSON string, received: ${this.utils.printReceived(rec)}`)
                ) : () => (
                    this.utils.matcherHint(matcherName, undefined, exp ? undefined : '', options)
                    + '\n\n'
                    + this.utils.printDiffOrStringify(
                        exp,
                        getObjectSubset(parsed, exp, this.customTesters),
                        'Expected',
                        'Received',
                        this.expand !== false,
                    )
                ),
        };
    },

    toBeYaml(this: jest.MatcherContext, rec: unknown, exp?: object) {
        const [matcherName, options] = ['toBeYaml', matcherHintOptions.call(this)];
        if (exp !== undefined && (typeof exp !== 'object' || exp === null)) {
            throw new Error(this.utils.matcherErrorMessage(
                this.utils.matcherHint(matcherName, undefined, undefined, options),
                `${this.utils.EXPECTED_COLOR('expected')} value must be a non-null object`,
                this.utils.printWithType('Expected', exp, this.utils.printExpected),
            ));
        }
        let pass = typeof rec === 'string' || rec instanceof String;
        if (!pass) {
            const message = () => (
                this.utils.matcherHint(matcherName, undefined, exp ? undefined : '', options)
                + `\n\nExpected a YAML string, received: ${this.utils.printReceived(rec)}`
            );
            return { pass, message };
        }
        let parsed: any;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            parsed = parseYaml(rec as string);
        } catch (e: unknown) {
            const message = () => (
                this.utils.matcherHint(matcherName, undefined, exp ? undefined : '', options)
                + `\n\nExpected a valid YAML string, received: ${this.utils.printReceived(rec)}`
                + `\n\n${(e as Error).message}`
            );
            return { pass: false, message };
        }
        if (exp !== undefined) {
            pass = this.equals(parsed, exp, [
                ...this.customTesters,
                this.utils.iterableEquality,
                this.utils.subsetEquality,
            ]);
        }
        return {
            pass,
            message: pass
                ? () => (
                    this.utils.matcherHint(matcherName, undefined, exp ? undefined : '', options)
                    + (exp ? (
                        `\n\nExpected not a YAML string matching ${this.utils.printExpected(exp)}`
                        + (this.utils.stringify(exp) === this.utils.stringify(parsed)
                            ? '' : `\nReceived:     ${this.utils.printReceived(parsed)}`)
                    ) : `\n\nExpected not a YAML string, received: ${this.utils.printReceived(rec)}`)
                ) : () => (
                    this.utils.matcherHint(matcherName, undefined, exp ? undefined : '', options)
                    + '\n\n'
                    + this.utils.printDiffOrStringify(
                        exp,
                        getObjectSubset(parsed, exp, this.customTesters),
                        'Expected',
                        'Received',
                        this.expand !== false,
                    )
                ),
        };
    },

    toBePng(val: unknown, expected: any) {
        const [matcherName, options] = ['toBePng', matcherHintOptions.call(this)];
        this.utils.ensureNoExpected(expected, matcherName, options);
        let pass = Buffer.isBuffer(val);
        pass &&= ![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].some((b, i) => (val as Buffer)[i] !== b);
        return {
            pass,
            message: () => (
                this.utils.matcherHint(matcherName, undefined, '', options)
                + `\n\nExpected value to ${pass ? 'not ' : ''}be a PNG buffer, received: ${this.utils.printReceived(val)}`
            ),
        };
    },

    toBeSvg(val: unknown, expected: any) {
        const [matcherName, options] = ['toBeSvg', matcherHintOptions.call(this)];
        this.utils.ensureNoExpected(expected, matcherName, options);
        let pass = typeof val === 'string' || val instanceof String;
        pass &&= (val as string).replace(/^\s*(?:(?:<\?xml.*?\?>|<!--.*?-->|<!DOCTYPE.*?>)\s*)*/, '').startsWith('<svg');
        return {
            pass,
            message: () => (
                this.utils.matcherHint(matcherName, undefined, '', options)
                + `\n\nExpected value to ${pass ? 'not ' : ''}be an SVG string, received: ${this.utils.printReceived(val)}`
            ),
        };
    },

    toBeNumber(val: unknown, expected: any) {
        const options = matcherHintOptions.call(this);
        this.utils.ensureNoExpected(expected, 'toBeNumber', options);
        const pass = typeof val === 'number';
        return {
            pass,
            message: () => (
                this.utils.matcherHint('toBeNumber', 'received', '', options)
                + `\n\nExpected value to ${pass ? 'not ' : ''}be a number, received: ${this.utils.printReceived(val)}`
            ),
        };
    },

    toBeUndefined(val: unknown, expected: any) {
        const options = matcherHintOptions.call(this);
        this.utils.ensureNoExpected(expected, 'toBeUndefined', options);
        const pass = val === undefined;
        return {
            pass,
            message: () => (
                this.utils.matcherHint('toBeUndefined', 'received', '', options)
                + '\n\n'
                + (pass ? 'Expected value to not be undefined'
                    : `Expected value to be undefined, received: ${this.utils.printReceived(val)}`)
            ),
        };
    },

    toBeString(val: unknown, expected: any) {
        const options = matcherHintOptions.call(this);
        this.utils.ensureNoExpected(expected, 'toBeString', options);
        const pass = typeof val === 'string' || val instanceof String;
        return {
            pass,
            message: () => (
                this.utils.matcherHint('toBeString', 'received', '', options)
                + `\n\nExpected value to ${pass ? 'not ' : ''}be a string, received: ${this.utils.printReceived(val)}`
            ),
        };
    },

    toBeFalsy(val: unknown, expected: any) {
        const options = matcherHintOptions.call(this);
        this.utils.ensureNoExpected(expected, 'toBeFalsy', options);
        const pass = !val;
        return {
            pass: !val,
            message: () => (
                this.utils.matcherHint('toBeFalsy', 'received', '', options)
                + `\n\nExpected value to ${pass ? 'not ' : ''}be falsy, received: ${this.utils.printReceived(val)}`
            ),
        };
    },
});

export {};