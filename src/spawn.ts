import { spawn, type IPty, type IDisposable } from 'node-pty';
import type { Socket } from 'net';
import { constants } from 'os';
import path from 'path';
import which from 'which';
import { onExit } from 'signal-exit';
import type { TerminalOptions } from './types';
import RecordingStream from './source';
import { promisifyStream, mergePromise } from './utils';
import log from './logger';

const signals = Object.entries(constants.signals) as (readonly [NodeJS.Signals, number])[];

type Env = Record<string, string | undefined>;

export interface PtyResult {
    killed: boolean
    timedOut: boolean
    exitCode: number | undefined
    signal: NodeJS.Signals | number | undefined
}

interface PtyOptions {
    /**
     * Working directory to be set for the child process.
     * @defaultValue `process.cwd()`
     */
    cwd?: string

    /**
     * Environment key-value pairs to be set for the child process. Automatically extends from `process.env`, which
     * can be changed by setting `extendEnv` to `false`.
     */
    env?: Env

    /**
     * Whether the child process env should extend from `process.env`. If false, only the `PATH` env variable
     * (plus `PATHEXT` & `SystemRoot` on windows) will be extended from the current process to the child process env.
     * @defaultValue `true`
     */
    extendEnv?: boolean

    /**
     * Windows only option passed to `node-pty` concerning whether to use ConPTY over WinPTY.
     * @defaultValue `false`
     */
    useConpty?: boolean | undefined
}

export interface SpawnOptions extends PtyOptions {
    /**
     * If true, runs the command inside of a shell. Unix will try to use the current shell (`process.env.SHELL`),
     * falling back to `/bin/sh` if that fails. Windows will try to use `process.env.ComSpec`, falling back to
     * `cmd.exe` if that fails. Different shells can be specified using a string. The shell should understand
     * the `-c` switch, or if the shell is `cmd.exe`, it should understand the `/d /s /c` switches.
     * @defaultValue `false`
     */
    shell?: boolean | string

    /**
     * Silently capture the spawned process' stdout and stderr output. If set to `false`, the output of
     * the spawned process will be piped to `process.stdout`.
     * @defaultValue `true`
     */
    silent?: boolean

    /**
     * Connect spawn to process.stdin to capture any input from the user. If the spawned process requires
     * user input to complete, this option must be enabled, or the process will hang. If enabled,
     * the `silent` option must be set to `false`, or omitted.
     * @defaultValue `false`
     */
    connectStdin?: boolean

    /**
     * The maximum amount of time the process is allowed to run in milliseconds. If greater than `0`, the signal
     * specified by `killSignal` will be sent if the child process runs longer than the timeout milliseconds.
     * @defaultValue `0`
     */
    timeout?: number

    /**
     * The signal to be used when the spawned process will be killed by timeout.
     * @defaultValue `'SIGTERM'`
     */
    killSignal?: NodeJS.Signals
}

export interface ShellOptions extends PtyOptions {
    /**
     * The shell to run. If unspecified, Unix will try to use the current shell (`process.env.SHELL`),
     * falling back to `/bin/sh` if that fails. Windows will try to use `process.env.ComSpec`, falling back to
     * `cmd.exe` if that fails.
     */
    shell?: string
}

export const colorEnv = {
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
};

const winEnvRequiredKeys = [
    'PATHEXT',
    'SystemRoot', // required for powershell to load (error 8009001d)
];

function getPathKey(env: Env) {
    return process.platform !== 'win32' ? 'PATH'
        : Object.keys(env).reverse().find((key) => key.toUpperCase() === 'PATH') ?? 'Path';
}

export function resolveEnv(envOpt: Env, extendEnv: boolean): Env {
    let env: Env = envOpt;
    // get path from process.env
    const pathKey = getPathKey(process.env);
    let PATH = process.env[pathKey];
    // extract path from env option spec if it exists
    const optPathKey = Object.keys(env).reverse().find((key) => key.toUpperCase() === 'PATH');
    if (optPathKey) ({ [optPathKey]: PATH, ...env } = env);
    // extend `process.env` or include subset of required keys if platform is windows
    if (extendEnv) {
        env = { ...process.env, ...env };
    } else if (process.platform === 'win32') {
        env = {
            ...winEnvRequiredKeys.reduce<Env>((acc, key) => {
                if (process.env[key]) acc[key] = process.env[key]!;
                return acc;
            }, {}),
            ...env,
        };
    }
    // set resolved env path
    if (PATH != null) env[pathKey] = PATH;
    // resolve term name, can be set by specified env
    env['TERM'] = envOpt['TERM'] ?? 'xterm-256color';
    // add required color related env variables
    env = { ...env, ...colorEnv };
    return env;
}

class PtyRecordingStream extends RecordingStream<PtyResult> {

    silent: boolean;

    env: Env;

    shell: string | undefined;

    constructor(options: TerminalOptions, silent: boolean, env: Env, shell?: string) {
        super(options);
        this.env = env;
        this.silent = silent;
        this.shell = shell;
    }

    override finish() {
        if (this.ended) return;
        super.finish();
        // indicate end of the capture if stream is not silent
        if (!this.silent) {
            process.stdout.write(`\n${PtyRecordingStream.kCaptureEndLine}`);
        }
    }
}

/**
 * Resolve the absolute path of the command to run - implementation draws heavily from `cross-spawn`:
 * {@link https://github.com/moxystudio/node-cross-spawn/blob/master/lib/util/resolveCommand.js}
 * @param command - command to run
 * @param cwd - directory to run command in
 * @param env - env configuration
 * @returns resolved command file path
 */
export function resolveCommand(command: string, cwd: string, env: Env) {
    // get the current working directory
    const thisCwd = process.cwd();
    // change to specified cwd if necessary
    if (cwd !== thisCwd) {
        try {
            process.chdir(cwd);
        } catch {}
    }
    // extract PATH from env
    const PATH = env[getPathKey(env)];
    // resolve command file path with `which`
    let resolved;
    try {
        resolved = which.sync(command, { path: PATH, pathExt: env['PATHEXT'] });
    } catch {
        try {
            // try resolving without path extension
            resolved = which.sync(command, { path: PATH, pathExt: path.delimiter });
        } catch {}
    }
    // change cwd back to original cwd if necessary
    if (cwd !== thisCwd) {
        try {
            process.chdir(thisCwd);
        } catch {}
    }
    // ensure that an absolute path is returned
    resolved &&= path.resolve((thisCwd !== cwd) ? cwd : '', resolved);
    return resolved ?? command;
}

interface WindowsTerminal extends IPty {
    _agent: {
        _inSocket: Socket
        _outSocket: Socket
        _pty: number
        _useConpty: boolean
        _useConptyDll: boolean
        _conoutSocketWorker: IDisposable
        _getConsoleProcessList: () => Promise<number[]>
        kill: () => void
        _ptyNative: { kill: (ptyId: number, useConptyDll: boolean) => void }
    }
    _deferNoArgs: (deferredFn: () => void) => void
    _close: () => void
}

/**
 * This is requird to fully close the spawned pty on windows due to bugs in `node-pty`.
 * It also promisifies the kill process so that it can be integrated into the stream promise pipeline
 */
function killPtyWindows(pty: WindowsTerminal): Promise<void> {
    return new Promise<void>((resolve) => {
        pty._deferNoArgs(() => {
            pty._close();
            if (!pty._agent._useConpty) {
                // close winpty
                pty._agent.kill();
                // without this worker won't exit and winpty will hang
                pty._agent._conoutSocketWorker.dispose();
                resolve();
                return;
            }
            // close conpty
            pty._agent._inSocket.readable = false;
            pty._agent._outSocket.readable = false;
            pty._agent._getConsoleProcessList().then((consoleProcessList) => {
                for (const pid of consoleProcessList) {
                    try {
                        process.kill(pid);
                    } catch {} // Ignore if process cannot be found (kill ESRCH error)
                }
                // kill after console process list has been returned, or else conpty_console_list will always timeout
                pty._agent._ptyNative.kill(pty._agent._pty, pty._agent._useConptyDll);
                pty._agent._conoutSocketWorker.dispose();
                resolve();
            });
        });
    });
}

function killPty(pty: IPty, signal?: string): Promise<void> {
    if (process.platform === 'win32') {
        return killPtyWindows(pty as WindowsTerminal);
    }
    pty.kill(signal);
    return Promise.resolve();
}

function hookStdin(handler: (chunk: Buffer) => void): IDisposable {
    // enable raw mode
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    // add data event handler
    process.stdin.on('data', handler);
    // resume stdin
    process.stdin.resume();
    // return cleanup handler
    return {
        dispose() {
            // pause stdin
            process.stdin.pause();
            // disable raw mode
            if (process.stdin.isTTY) process.stdin.setRawMode(false);
            // remove data event handler
            process.stdin.off('data', handler);
        },
    };
}

interface PtyState {
    closed: boolean
    kill: Promise<void> | null
}

function promisifyPty(
    stream: PtyRecordingStream,
    spawned: IPty,
    state: PtyState,
    { timeout, killSignal }: Required<Pick<SpawnOptions, 'timeout' | 'killSignal'>>,
    dataHook: IDisposable,
    stdinHook: IDisposable | null,
    ac: AbortController,
) {
    // start a promise chain
    let promise = new Promise<PtyResult>((resolve) => {
        const exitHook = spawned.onExit((event) => {
            // update state
            state.closed = true;
            // dispose of hooks
            dataHook.dispose();
            stdinHook?.dispose();
            exitHook.dispose();
            // finish the stream
            stream.finish();
            // prevent hanging on windows
            if (process.platform === 'win32') {
                (spawned as WindowsTerminal)._agent._conoutSocketWorker.dispose();
            }
            // resolve spawn result
            resolve({
                exitCode: event.exitCode,
                signal: ((event.signal && signals.find(([, n]) => n === event.signal)) || [])[0] ?? event.signal,
                timedOut: false,
                killed: false,
            });
        });
    });
    // setup timeout
    if (timeout > 0) {
        let timeoutId: NodeJS.Timeout;
        const spawnPromise = promise;
        // chain timeout race
        promise = Promise.race([
            new Promise<never>((resolve, reject) => {
                timeoutId = setTimeout(() => {
                    // kill the spawned process if it hasn't been closed yet
                    if (!state.closed && !state.kill) state.kill = killPty(spawned, killSignal);
                    // reject to end the race
                    reject(new Error('Timed out'));
                }, timeout);
            }),
            spawnPromise.finally(() => {
                clearTimeout(timeoutId);
            }),
        ]).catch<PtyResult>(() => (
            spawnPromise.then((result) => ({ ...result, timedOut: true }))
        ));
    }
    // add signal-exit handler
    const cleanupExitHandler = onExit(() => {
        if (!state.closed && !state.kill) {
            // kill spawned shell using SIGKILL to prevent hang on unix
            state.kill = killPty(spawned, 'SIGKILL');
        }
    });
    // cleanup exit handler
    promise = promise.finally(() => {
        cleanupExitHandler();
    });
    // handle kill promise
    promise = promise.then((result) => {
        if (state.kill) {
            return state.kill.then(() => ({ ...result, killed: true }));
        }
        return result;
    });
    // merge source stream and promise chain
    return mergePromise(stream, Promise.all([
        // finally, set the result on the stream
        promise.then((result) => {
            // set the result
            stream.setResult(result);
            log.debug('spawned process complete: %O', result);
        }),
        // create stream promise to ensure 'close' event is fired
        promisifyStream(stream, ac),
    ]).then(() => {}));
}

export function readableSpawn(command: string, args: string[], {
    shell = false,
    cwd = process.cwd(),
    env: envOption,
    extendEnv = true,
    connectStdin = false,
    silent = !connectStdin,
    timeout = 0,
    killSignal = 'SIGTERM',
    useConpty = false,
    ...opts
}: TerminalOptions & SpawnOptions, ac: AbortController) {
    // validate args
    if (typeof command !== 'string') {
        throw new TypeError(`'command' must be a string. Received ${command as any}`);
    }
    if (command.length === 0) {
        throw new Error("'command' cannot be empty");
    }
    // validate timeout option
    if (!(typeof timeout === 'number' && Number.isFinite(timeout) && timeout >= 0)) {
        throw new TypeError('`timeout` must be a non-negative integer');
    }
    // validate silent / connectStdin
    if (connectStdin && silent) {
        throw new Error("'silent' option must be false if 'connectStdin' is true");
    }
    // resolve env
    const env = resolveEnv(envOption ?? {}, extendEnv);
    // resolve file & args
    let file: string,
        _args: string[] | string = args;
    if (shell) {
        // resolve shell path
        const cmd = [command, ...args].join(' ');
        if (process.platform === 'win32') {
            file = typeof shell === 'string' ? shell : env['ComSpec'] ?? process.env['ComSpec'] ?? 'cmd.exe';
            _args = /^(?:.*\\)?cmd(?:\.exe)?$/i.test(file) ? ['/d', '/s', '/c', `"${cmd}"`].join(' ') : ['-c', cmd];
        } else {
            file = typeof shell === 'string' ? shell : env['SHELL'] ?? process.env['SHELL'] ?? '/bin/sh';
            _args = ['-c', cmd];
        }
    } else {
        // resolve path to command
        file = resolveCommand(command, cwd, env);
    }
    log.debug('spawning process (file: %S args: %O)', file, _args);
    // indicate start of the capture
    if (!silent) process.stdout.write(PtyRecordingStream.kCaptureStartLine);
    // create recording source stream
    const stream = new PtyRecordingStream(opts, silent, env, shell ? file : undefined),
        // create pty child process
        spawned = spawn(file, _args, {
            name: env['TERM']!,
            cols: opts.columns,
            rows: opts.rows,
            env,
            cwd,
            useConpty,
        }),
        // track pty state
        state: PtyState = { closed: false, kill: null };
    // emit stream start event
    stream.start([command, ...args].join(' '));
    // attach data listener
    const dataHook = spawned.onData((chunk: string) => {
        if (!silent) process.stdout.write(chunk);
        stream.write(chunk);
    });
    // connect stdin
    let stdinHook: IDisposable | null = null;
    if (connectStdin) {
        stdinHook = hookStdin((chunk: Buffer) => {
            spawned.write(chunk.toString());
        });
    }
    // promisify spawned pty
    return promisifyPty(stream, spawned, state, { timeout, killSignal }, dataHook, stdinHook, ac);
}

export function readableShell({
    shell,
    cwd = process.cwd(),
    env: envOption,
    extendEnv = true,
    useConpty = false,
    ...opts
}: TerminalOptions & ShellOptions, ac: AbortController) {
    // resolve env
    const env = resolveEnv(envOption ?? {}, extendEnv),
        // resolve shell
        file = typeof shell === 'string' ? shell : process.platform === 'win32'
            ? (env['ComSpec'] ?? process.env['ComSpec'] ?? 'cmd.exe')
            : (env['SHELL'] ?? process.env['SHELL'] ?? '/bin/sh');
    log.debug('launching pty shell (file: %S)', file);
    // create recording source stream
    const stream = new PtyRecordingStream(opts, false, env, file),
        // create pty child process
        spawned = spawn(file, [], {
            name: env['TERM']!,
            cols: opts.columns,
            rows: opts.rows,
            env,
            cwd,
            useConpty,
        }),
        // track pty state
        state: PtyState = { closed: false, kill: null };
    // indicate start of the capture
    process.stdout.write(PtyRecordingStream.kCaptureStartLine);
    // emit stream start event
    stream.start();
    // attach data listener
    const dataHook = spawned.onData((chunk: string) => {
        process.stdout.write(chunk);
        stream.write(chunk);
    });
    // track if Ctrl-D has been recieved
    let interrupted = false;
    // connect stdin
    const stdinHook = hookStdin((chunk: Buffer) => {
        const str = chunk.toString();
        // check for EOT control code (ctrl-D)
        if (str.includes('\x04')) {
            // stop if stream has already been interupted
            if (interrupted) return;
            // set interrupted flag
            interrupted = true;
            // finish the stream
            stream.finish();
            // remove data hook
            dataHook.dispose();
            // kill the process if it has not been killed yet
            if (!state.closed && !state.kill) state.kill = killPty(spawned, 'SIGKILL');
        } else spawned.write(str);
    });
    // create promise chain
    return promisifyPty(stream, spawned, state, { timeout: 0, killSignal: 'SIGTERM' }, dataHook, stdinHook, ac);
}