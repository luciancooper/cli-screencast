import path from 'path';
import signalExit from 'signal-exit';
import { stdin as mockStdin } from 'mock-stdin';
import { stripAnsi } from 'tty-strings';
import type { SourceEvent } from '@src/source';
import { readableSpawn, readableShell, resolveEnv, resolveCommand, colorEnv, type PtyResult } from '@src/spawn';
import mockStdout, { type MockStdout } from './helpers/mockStdout';
import { consumePromise } from './helpers/streams';

let stdout: MockStdout,
    stdin: ReturnType<typeof mockStdin>;

type SignalExitHandler = (code: number | null, signal: NodeJS.Signals | null) => void;

interface MockSignalExit extends jest.Mocked<typeof signalExit> {
    flush: (...args: Parameters<SignalExitHandler>) => number
    flushAfter: (ms: number, ...args: Parameters<SignalExitHandler>) => Promise<number>
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
        flushAfter(ms: number, ...args: Parameters<SignalExitHandler>) {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            }).then(() => this.flush(...args));
        },
        reset() {
            queued = [];
            mocked.mockClear();
        },
    });
    return mocked;
});

beforeAll(() => {
    stdout = mockStdout();
    stdin = mockStdin();
});

afterEach(() => {
    stdout.reset();
    (signalExit as MockSignalExit).reset();
});

afterAll(() => {
    stdout.restore();
    stdin.restore();
});

describe('resolveEnv', () => {
    const originalEnv = process.env;

    afterEach(() => {
        process.env = originalEnv;
    });

    test('matches env option PATH key case to process.env PATH key case', () => {
        process.env = { PATH: '.' };
        expect(resolveEnv({ path: process.cwd(), attr: 'value' }, true)).toEqual({
            attr: 'value',
            PATH: process.cwd(),
            TERM: 'xterm-256color',
            ...colorEnv,
        });
    });

    test('the TERM key can be set from from env option but not from process.env', () => {
        process.env = { TERM: 'xcode' };
        // no TERM spec provided
        expect(resolveEnv({}, true)).toEqual({ TERM: 'xterm-256color', ...colorEnv });
        // TERM spec provided
        expect(resolveEnv({ TERM: 'xterm-spec' }, true)).toEqual({ TERM: 'xterm-spec', ...colorEnv });
    });
});

describe('resolveCommand', () => {
    const env = resolveEnv({}, true);

    test('returns absolute path to command', () => {
        expect(path.isAbsolute(resolveCommand('node', process.cwd(), env))).toBe(true);
    });

    test('does not resolve nonexistant commands', () => {
        expect(resolveCommand('abcd', process.cwd(), env)).toBe('abcd');
    });

    test('relative paths are resolved if file is found', () => {
        const cmd = resolveCommand('node_modules/.bin/jest', process.cwd(), env);
        expect(cmd.replace(/\b(\w+)\.\w+$/, '$1')).toBe(path.join(process.cwd(), 'node_modules', '.bin', 'jest'));
    });

    test('relative paths are not resolved if file is not found', () => {
        expect(resolveCommand('.bin/jest', process.cwd(), env)).toBe('.bin/jest');
    });

    test('relative paths can be resolved from alternate cwd paths', () => {
        const cmd = resolveCommand('.bin/jest', path.join(process.cwd(), 'node_modules'), env);
        expect(cmd.replace(/\b(\w+)\.\w+$/, '$1')).toBe(path.join(process.cwd(), 'node_modules', '.bin', 'jest'));
    });

    test('commands can be resolved from specified env PATH', () => {
        const bin = path.join(process.cwd(), 'node_modules', '.bin'),
            cmd = resolveCommand('jest', process.cwd(), resolveEnv({ PATH: bin }, false));
        expect(cmd.replace(/\b(\w+)\.\w+$/, '$1')).toBe(path.join(bin, 'jest'));
    });
});

describe('readableSpawn', () => {
    const dimensions = { columns: 20, rows: 5 };

    test('creates readable source events from subprocess writes to stdout', async () => {
        const source = readableSpawn('echo', ['log message'], { ...dimensions, shell: true }),
            [result, events] = await consumePromise<PtyResult, SourceEvent>(source);
        // check the result
        expect(result.exitCode).toBe(0);
        expect(result.signal).toBeFalsy();
        // check start event
        expect(events[0]).toMatchObject<Partial<SourceEvent>>(
            { type: 'start', command: 'echo log message', ...dimensions },
        );
        // check finish event
        expect(events[events.length - 1]).toMatchObject<Partial<SourceEvent>>({ type: 'finish' });
        // check write events
        expect(events.slice(1, -1)).toEachMatchObject<SourceEvent>({
            content: expect.toBeString(),
            time: expect.toBeNumber(),
        });
        // concat all write events
        expect(
            stripAnsi((events.slice(1, -1) as Extract<SourceEvent, { type?: never }>[]).map((e) => e.content).join(''))
                .replace(/\r+\n/g, '\n'),
        ).toBe('log message\n');
    });

    test('kills spawned subprocess if parent process exits', async () => {
        const source = readableSpawn('sleep', ['10'], {
            ...dimensions,
            shell: process.platform === 'win32' ? 'powershell.exe' : true,
        });
        // mock the process exiting
        await (signalExit as MockSignalExit).flushAfter(250, 1, 'SIGINT');
        // result should have exit code 1 & signal 'SIGINT'
        await expect(source).resolves.toMatchObject<Partial<PtyResult>>({
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
        const [result, events] = await consumePromise<PtyResult, SourceEvent>(source);
        // check result
        expect(result.exitCode).toBe(0);
        expect(result.signal).toBeFalsy();
        // check start event
        expect(events[0]).toMatchObject<Partial<SourceEvent>>({ type: 'start', ...dimensions });
        // check finish event
        expect(events[events.length - 1]).toMatchObject<Partial<SourceEvent>>({ type: 'finish' });
        // check write events
        expect(events.slice(1, -1)).toEachMatchObject<SourceEvent>({
            content: expect.toBeString(),
            time: expect.toBeNumber(),
        });
        // check stdout
        expect(
            stripAnsi(stdout.output.replace(/\x1b\[1?G/g, '\r'))
                .trimEnd()
                .split(/\r*\n/g)
                .map((l) => l.replace(/^.*\r/, ''))
                .filter(Boolean),
        ).toEqual([
            '>>> ● Capture Start >>>',
            'Prompt: Response',
            'Response',
            '<<< ■ Capture End <<<',
        ]);
    });

    test('subprocess env will not extend process.env if `extendEnv` is false', async () => {
        const source = readableSpawn('echo', ['message'], {
                ...dimensions,
                shell: true,
                env: {},
                extendEnv: false,
            }),
            result = await source;
        // check env
        expect(source.env).toEqual(resolveEnv({}, false));
        // check result
        expect(result.exitCode).toBe(0);
        expect(result.signal).toBeFalsy();
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
            await expect(readableSpawn('sleep', ['5'], {
                ...dimensions,
                shell: process.platform === 'win32' ? 'powershell.exe' : true,
                timeout: 500,
                killSignal: 'SIGKILL',
            })).resolves.toMatchObject<Partial<PtyResult>>({
                exitCode: 1,
                signal: 'SIGKILL',
                timedOut: true,
            });
        });

        test('timeout is cleared if process completes before it is reached', async () => {
            const result = await readableSpawn('sleep', ['1'], {
                ...dimensions,
                shell: process.platform === 'win32' ? 'powershell.exe' : true,
                timeout: 4000,
            });
            expect(result.exitCode).toBe(0);
            expect(result.signal).toBeFalsy();
            expect(result.timedOut).toBe(false);
        });
    });
});

describe('readableShell', () => {
    const dimensions = { columns: 40, rows: 10 };

    test('shell can be specified as an option', async () => {
        const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
            source = readableShell({ shell, ...dimensions });
        // send mocks stdin after first write to stdout
        await stdout.nextWrite().then(() => {
            stdin.send('exit\r\n');
        });
        // consume events
        const [result, events] = await consumePromise<PtyResult, SourceEvent>(source);
        // check shell
        expect(source.shell).toBe(shell);
        // check result
        expect(result.exitCode).toBe(0);
        expect(result.signal).toBeFalsy();
        // check start event
        expect(events[0]).toMatchObject<Partial<SourceEvent>>({ type: 'start', ...dimensions });
        // check finish event
        expect(events[events.length - 1]).toMatchObject<Partial<SourceEvent>>({ type: 'finish' });
        // check write events
        expect(events.slice(1, -1)).toEachMatchObject<SourceEvent>({
            content: expect.toBeString(),
            time: expect.toBeNumber(),
        });
    });

    test('stops recording on ctrl-d', async () => {
        const source = readableShell(dimensions);
        // send mocks stdin after first write to stdout
        await stdout.nextWrite().then(() => {
            stdin.send('\x04');
        });
        // consume events
        const [result, events] = await consumePromise<PtyResult, SourceEvent>(source);
        // check result
        expect(result.exitCode).toBe(0);
        // check start event
        expect(events[0]).toMatchObject<Partial<SourceEvent>>({ type: 'start', ...dimensions });
        // check finish event
        expect(events[events.length - 1]).toMatchObject<Partial<SourceEvent>>({ type: 'finish' });
        // check write events
        expect(events.slice(1, -1)).toEachMatchObject<SourceEvent>({
            content: expect.toBeString(),
            time: expect.toBeNumber(),
        });
    });

    test('kills shell if parent process exits', async () => {
        const source = readableShell(dimensions);
        // mock the process exiting
        await (signalExit as MockSignalExit).flushAfter(250, 1, 'SIGINT');
        // result should have exit code 1 & signal 'SIGINT'
        await expect(source).resolves.toMatchObject<Partial<PtyResult>>({
            exitCode: 1,
            signal: 'SIGINT',
        });
    });

    test('subprocess shell env will not extend process.env if `extendEnv` is false', async () => {
        const source = readableShell({ ...dimensions, env: {}, extendEnv: false });
        // send mocks stdin after first write to stdout
        await stdout.nextWrite().then(() => {
            stdin.send('exit\r\n');
        });
        const result = await source;
        // check env
        expect(source.env).toEqual(resolveEnv({}, false));
        // check result
        expect(result.exitCode).toBe(0);
        expect(result.signal).toBeFalsy();
    });
});