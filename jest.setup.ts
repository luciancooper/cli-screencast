/* eslint-disable @typescript-eslint/no-namespace */

declare global {
    namespace jest {
        interface Matchers<R> {
            toBeApprox: (expected: number | bigint, threshold?: number) => R
        }
        interface Expect {
            toBeApprox: (expected: number | bigint, threshold?: number) => number
        }
        interface InverseAsymmetricMatchers {
            toBeApprox: (expected: number | bigint, threshold?: number) => number
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
});

export {};