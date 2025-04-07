import type { Socket } from 'net';

export interface MockStdout {
    readonly writes: string[]
    readonly output: string
    nextWrite: () => Promise<void>
    reset: () => void
    restore: () => void
}

export default function mockStdout(): MockStdout {
    const spies: jest.SpiedFunction<jest.Mock<ReturnType<Socket['write']>, Parameters<Socket['write']>>>[] = [];
    let writes: string[] = [],
        queue: { resolve: () => void, reject: (reason?: any) => void }[] = [];
    // create mock stdout & stderr write streams
    for (const id of ['stdout', 'stderr'] as const) {
        // spy on process
        const spy = jest.spyOn(process[id], 'write').mockImplementation(
            jest.fn((data, enc?, callback?): boolean => {
                writes.push(typeof data === 'string' ? data : data.toString());
                for (const promise of queue) promise.resolve();
                queue = [];
                if (callback) callback();
                return true;
            }),
        );
        spies.push(spy);
    }
    // return mock stdout object
    return {
        get writes() {
            return writes;
        },
        get output() {
            return writes.join('');
        },
        reset() {
            writes = [];
            for (const promise of queue) promise.reject(Error('No write'));
            queue = [];
        },
        nextWrite() {
            return new Promise<void>((resolve, reject) => {
                queue.push({ resolve, reject });
            });
        },
        restore() {
            spies.forEach((spy) => {
                spy.mockRestore();
            });
        },
    };
}