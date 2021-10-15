import signalExit from 'signal-exit';
import type { DeepPartial } from '@src/types';
import type { SourceEvent } from '@src/source';
import readableSpawn, { colorEnv, SpawnResult } from '@src/spawn';
import { readStream } from './helpers/streams';

interface MockSignalExit extends jest.Mocked<typeof signalExit> {
    flush: () => number
    reset: () => void
}

jest.mock('signal-exit', () => {
    let queued: (() => void)[] = [];
    const mocked = Object.assign(jest.fn((callback: () => void) => {
        queued.push(callback);
        return () => {
            const idx = queued.findIndex((cb) => cb === callback);
            if (idx >= 0) queued.splice(idx, 1);
        };
    }), {
        flush() {
            let n = 0;
            for (; queued.length > 0; n += 1) (queued.pop()!)();
            return n;
        },
        reset() {
            queued = [];
            mocked.mockClear();
        },
    });
    return mocked;
});

afterEach(() => {
    (signalExit as MockSignalExit).reset();
});

describe('readableSpawn', () => {
    const dimensions = { columns: 20, rows: 5 };

    test('creates readable source events from subprocess writes to stdout', async () => {
        const source = readableSpawn('echo', ['echo to source stream'], dimensions),
            events = await readStream<SourceEvent>(source);
        expect(events[0]).toEqual<SourceEvent>({
            type: 'start',
            command: 'echo "echo to source stream"',
        });
        expect(events[events.length - 1]).toMatchObject<DeepPartial<SourceEvent>>({
            type: 'finish',
            result: { exitCode: 0, failed: false },
        });
        expect(events.length).toBeGreaterThan(2);
    });

    test('kills spawned subprocess if parent process exits', async () => {
        const source = readableSpawn('sleep', ['10'], dimensions);
        // mock the process exiting
        (signalExit as MockSignalExit).flush();
        await expect(source).resolves.toMatchObject<Partial<SpawnResult>>({
            timedOut: false,
            killed: true,
        });
    });

    test('subprocess env will not extend process.env if `extendEnv` is false', async () => {
        const source = readableSpawn('sleep', ['0'], { ...dimensions, env: {}, extendEnv: false });
        await expect(source).resolves.toMatchObject<Partial<SpawnResult>>({ exitCode: 0, failed: false });
        expect(source.env).toEqual(colorEnv);
    });

    describe('validation', () => {
        test('throws an error if `command` arg is an empty string', async () => {
            expect(() => {
                readableSpawn('', [], dimensions);
            }).toThrow("'command' cannot be empty");
        });

        test('throws type error if `command` arg is not a string', async () => {
            expect(() => {
                readableSpawn({} as unknown as string, [], dimensions);
            }).toThrow("'command' must be a string. Received [object Object]");
        });

        test('throws error if timeout option is invalid', () => {
            expect(() => {
                readableSpawn('ls', [], { ...dimensions, timeout: -500 });
            }).toThrow('`timeout` must be a non-negative integer');
        });
    });

    describe('timeouts', () => {
        test('will send `killSignal` signal to spawned process on timeout', async () => {
            await expect(readableSpawn('sleep', ['1'], {
                ...dimensions,
                timeout: 500,
                killSignal: 'SIGKILL',
            })).resolves.toMatchObject<Partial<SpawnResult>>({
                ...process.platform !== 'win32' ? { signal: 'SIGKILL' } : {},
                timedOut: true,
                killed: true,
            });
        });

        test('timeout is cleared if process completes before it is reached', async () => {
            const source = readableSpawn('sleep', ['1'], { ...dimensions, timeout: 2000 });
            await expect(source).resolves.toMatchObject<Partial<SpawnResult>>({
                timedOut: false,
                failed: false,
                killed: false,
            });
        });
    });
});