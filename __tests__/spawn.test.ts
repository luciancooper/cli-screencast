import path from 'path';
import signalExit from 'signal-exit';
import { stdin as mockStdin } from 'mock-stdin';
import { stripAnsi } from 'tty-strings';
import type { DeepPartial } from '@src/types';
import type { SourceEvent } from '@src/source';
import readableSpawn, { resolveCommand, colorEnv, type SpawnResult } from '@src/spawn';
import mockStdout from './helpers/mockStdout';
import { consume } from './helpers/streams';

const stdout = mockStdout(),
    stdin = mockStdin();

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
    stdout.reset();
    (signalExit as MockSignalExit).reset();
});

afterAll(() => {
    stdout.restore();
    stdin.restore();
});

describe('resolveCommand', () => {
    test('returns absolute path to command', () => {
        expect(path.isAbsolute(resolveCommand('node', process.cwd()))).toBe(true);
    });

    test('does not resolve nonexistant commands', () => {
        expect(resolveCommand('abcd', process.cwd())).toBe('abcd');
    });

    test('relative paths are resolved if file is found', () => {
        const cmd = resolveCommand('node_modules/.bin/jest', process.cwd());
        expect(cmd.replace(/\b(\w+)\.\w+$/, '$1')).toBe(path.join(process.cwd(), 'node_modules', '.bin', 'jest'));
    });

    test('relative paths are not resolved if file is not found', () => {
        expect(resolveCommand('.bin/jest', process.cwd())).toBe('.bin/jest');
    });

    test('relative paths can be resolved from alternate cwd paths', () => {
        const cmd = resolveCommand('.bin/jest', path.join(process.cwd(), 'node_modules'));
        expect(cmd.replace(/\b(\w+)\.\w+$/, '$1')).toBe(path.join(process.cwd(), 'node_modules', '.bin', 'jest'));
    });

    test('commands can be resolved from specified env PATH', () => {
        const cmd = resolveCommand('jest', process.cwd(), { PATH: path.join(process.cwd(), 'node_modules', '.bin') });
        expect(cmd.replace(/\b(\w+)\.\w+$/, '$1')).toBe(path.join(process.cwd(), 'node_modules', '.bin', 'jest'));
    });
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

    test('accepts user input from stdin', async () => {
        const source = readableSpawn('node', [
            '-e',
            "const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });"
            + "rl.question('Prompt: ', (a) => { console.log(a); rl.close(); });",
        ], { ...dimensions, connectStdin: true });
        // send mocks stdin after first write to stdout
        await stdout.nextWrite().then(() => {
            stdin.send('Response\n');
        });
        // consume events
        const events = await consume<SourceEvent>(source);
        // check events
        expect(events.length).toBeGreaterThan(2);
        expect(events[events.length - 1]).toMatchObject<DeepPartial<SourceEvent>>({
            type: 'finish',
            result: { exitCode: 0, failed: false },
        });
        // check stdout
        expect(stripAnsi(stdout.output).trimEnd().split(/\r*\n/g).map((l) => l.replace(/^.+\r/, ''))).toEqual([
            '>>> ● Capture Start >>>',
            'Prompt: Response',
            'Response',
            '<<< ■ Capture End <<<',
        ]);
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

        test('throws error if both connectStdin and silent options are enabled', () => {
            expect(() => {
                readableSpawn('ls', [], { ...dimensions, silent: true, connectStdin: true });
            }).toThrow("'silent' option must be false if 'connectStdin' is true");
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