import { spawn, type IPty, type IDisposable } from 'node-pty';
import { constants } from 'os';
import path from 'path';
import which from 'which';
import onExit from 'signal-exit';
import type { TerminalOptions } from './types';
import RecordingStream from './source';
import { promisifyStream, mergePromise } from './utils';
import log from './logger';

const signals = Object.entries(constants.signals) as (readonly [NodeJS.Signals, number])[];

type Env = Record<string, string | undefined>;

export interface PtyResult {
    exitCode: number
    timedOut: boolean
    signal?: NodeJS.Signals | number | undefined
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
     * Windows only passed to `node-pty` concerning whether to use ConPTY over WinPTY.
     * Added as a workaround until {@link https://github.com/microsoft/node-pty/issues/437} is resolved
     * @defaultValue `false`
     */
    useConpty?: boolean
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

function hookStdin(handler: (chunk: Buffer) => void) {
    // enable raw mode
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    // add data event handler
    process.stdin.on('data', handler);
    // resume stdin
    process.stdin.resume();
    // return cleanup handler
    return () => {
        // pause stdin
        process.stdin.pause();
        // disable raw mode
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        // remove data event handler
        process.stdin.off('data', handler);
    };
}

interface PtyState {
    killed: boolean
    exitCode: number | undefined
    signal: NodeJS.Signals | number | undefined
}

function createSpawnPromise(
    spawned: IPty,
    stream: PtyRecordingStream,
    dataHook: IDisposable,
    state: PtyState,
    kill: (sig?: string) => void,
) {
    return new Promise<PtyResult>((resolve) => {
        const exitHook = spawned.onExit((event) => {
            // dispose of hooks
            dataHook.dispose();
            exitHook.dispose();
            // kill spawned process to prevent hanging on windows
            if (!state.killed) kill();
            // update exit code & signal
            state.exitCode ??= event.exitCode;
            state.signal ??= ((event.signal && signals.find(([, n]) => n === event.signal)) || [])[0] ?? event.signal;
            // finish the stream
            stream.finish();
            // resolve spawn result
            resolve({
                exitCode: state.exitCode,
                signal: state.signal,
                timedOut: false,
            });
        });
    });
}

function addSignalExitHandler(promise: Promise<PtyResult>, state: PtyState, kill: (sig?: string) => void) {
    // add signal-exit handler
    const cleanupExitHandler = onExit((code, sig) => {
        if (!state.killed) {
            // set exit code & signal
            state.exitCode ??= code ?? 1;
            if (sig) state.signal ??= sig as NodeJS.Signals;
            // kill spawned shell using SIGKILL to prevent hang on unix
            kill(process.platform !== 'win32' ? 'SIGKILL' : undefined);
        }
    });
    // cleanup exit handler
    return promise.finally(() => {
        cleanupExitHandler();
    });
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
        state: PtyState = { killed: false, exitCode: undefined, signal: undefined };
    // emit stream start event
    stream.start([command, ...args].join(' '));
    // attach data listener
    const dataHook = spawned.onData((chunk: string) => {
        if (!silent) process.stdout.write(chunk);
        stream.write(chunk);
    });
    // kill spawn handler
    let kill = (sig?: string) => {
        state.killed = true;
        spawned.kill(sig);
    };
    // connect stdin
    if (connectStdin) {
        // hook stdin data handler
        const cleanupStdin = hookStdin((chunk: Buffer) => {
                spawned.write(chunk.toString());
            }),
            wrapped = kill;
        // wrap kill method with cleanup handler
        kill = (sig?: string) => {
            // disconnect stdin
            cleanupStdin();
            // call wrapped kill method
            wrapped(sig);
        };
    }
    // create spawn promise
    const spawnPromise = createSpawnPromise(spawned, stream, dataHook, state, kill);
    // start a promise chain
    let promise = spawnPromise;
    // setup timeout
    if (timeout > 0) {
        let timeoutId: NodeJS.Timeout;
        // chain timeout race
        promise = Promise.race([
            new Promise<never>((resolve, reject) => {
                timeoutId = setTimeout(() => {
                    // kill the spawned process
                    if (!state.killed) {
                        // set exit code & signal
                        state.exitCode = 1;
                        state.signal = killSignal;
                        // kill spawned process
                        kill(process.platform !== 'win32' ? killSignal : undefined);
                    }
                    // reject to end the race
                    reject(new Error('Timed out'));
                }, timeout);
            }),
            promise.finally(() => {
                clearTimeout(timeoutId);
            }),
        ]).catch<PtyResult>((error: Error) => spawnPromise.then((result) => ({
            ...result,
            timedOut: true,
        })));
    }
    // add signal-exit handler
    promise = addSignalExitHandler(promise, state, kill);
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
        state: PtyState = { killed: false, exitCode: undefined, signal: undefined };
    // indicate start of the capture
    process.stdout.write(PtyRecordingStream.kCaptureStartLine);
    // emit stream start event
    stream.start();
    // attach data listener
    const dataHook = spawned.onData((chunk: string) => {
        process.stdout.write(chunk);
        stream.write(chunk);
    });
    // kill method
    let kill: (sig?: string) => void;
    // connect stdin
    const cleanupStdin = hookStdin((chunk: Buffer) => {
        const str = chunk.toString();
        // check for ctrl-D
        if (str === '\x04') {
            // finish the stream
            stream.finish();
            // kill the process if it has not been killed yet
            if (!state.killed) {
                kill(process.platform !== 'win32' ? 'SIGKILL' : undefined);
            }
        } else spawned.write(str);
    });
    // kill spawn handler
    kill = (sig?: string) => {
        // disconnect stdin
        cleanupStdin();
        // kill the spawn
        state.killed = true;
        spawned.kill(sig);
    };
    // create spawn promise chain
    let promise = createSpawnPromise(spawned, stream, dataHook, state, kill);
    // add signal-exit handler
    promise = addSignalExitHandler(promise, state, kill);
    // merge source stream and promise chain
    return mergePromise(stream, Promise.all([
        // finally, set the result on the stream
        promise.then((result) => {
            // set stream result
            stream.setResult(result);
            log.debug('shell process complete: %O', result);
        }),
        // create stream promise to ensure 'close' event is fired
        promisifyStream(stream, ac),
    ]).then(() => {}));
}