import signalExit from 'signal-exit';
import type { DeepPartial } from '@src/types';
import type { SourceEvent } from '@src/source';
import readableSpawn, { colorEnv, SpawnResult } from '@src/spawn';
import { consume } from './helpers/streams';

type SignalExitHandler = (code: number | null, signal: NodeJS.Signals | null) => void;

interface MockSignalExit extends jest.Mocked<typeof signalExit> {
    flush: (...args: Parameters<SignalExitHandler>) => number
    reset: () => void
}

jest.mock('signal-exit', () => {
    let queued: SignalExitHandler[] = [];
    const mocked = Object.assign(jest.fn((callback: () => void) => {
        queued.push(callback);
        return () => {
            const idx = queued.findIndex((cb) => cb === callback);
            if (idx >= 0) queued.splice(idx, 1);
        };
    }), {
        flush(...args: Parameters<SignalExitHandler>) {
            let n = 0;
            for (; queued.length > 0; n += 1) (queued.pop()!)(...args);
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
        const source = readableSpawn('node', ['-e', "process.stdout.write('echo to source stream');"], dimensions),
            events = await consume<SourceEvent>(source);
        expect(events[0]).toEqual<SourceEvent>({
            type: 'start',
            command: 'node -e "process.stdout.write(\'echo to source stream\');"',
        });
        expect(events[events.length - 1]).toMatchObject<DeepPartial<SourceEvent>>({
            type: 'finish',
            result: { exitCode: 0, failed: false },
        });
        expect(events.length).toBeGreaterThan(2);
    });

    test('kills spawned subprocess if parent process exits', async () => {
        const source = readableSpawn(
            'node',
            ['-e', 'new Promise((resolve) => setTimeout(resolve, 5000));'],
            dimensions,
        );
        // mock the process exiting
        (signalExit as MockSignalExit).flush(1, 'SIGINT');
        await expect(source).resolves.toMatchObject<Partial<SpawnResult>>({
            exitCode: 1,
            signal: 'SIGINT',
            timedOut: false,
        });
    });

    test('subprocess env will not extend process.env if `extendEnv` is false', async () => {
        const source = readableSpawn(
            'node',
            ['-e', 'new Promise((resolve) => setTimeout(resolve, 0));'],
            { ...dimensions, env: {}, extendEnv: false },
        );
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
            await expect(readableSpawn(
                'node',
                ['-e', 'new Promise((resolve) => setTimeout(resolve, 1000));'],
                { ...dimensions, timeout: 500, killSignal: 'SIGKILL' },
            )).resolves.toMatchObject<Partial<SpawnResult>>({
                exitCode: 1,
                signal: 'SIGKILL',
                timedOut: true,
            });
        });

        test('timeout is cleared if process completes before it is reached', async () => {
            const source = readableSpawn(
                'node',
                ['-e', 'new Promise((resolve) => setTimeout(resolve, 1000));'],
                { ...dimensions, timeout: 2000 },
            );
            await expect(source).resolves.toMatchObject<Partial<SpawnResult>>({
                timedOut: false,
                failed: false,
            });
        });
    });
});