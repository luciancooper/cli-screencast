import * as pty from 'node-pty';
import { constants } from 'os';
import path from 'path';
import which from 'which';
import onExit from 'signal-exit';
import type { Dimensions } from './types';
import RecordingStream from './source';
import { mergePromise } from './utils';

const signals = Object.entries(constants.signals) as (readonly [NodeJS.Signals, number])[];

type Env = Record<string, string>;

export interface SpawnResult {
    exitCode: number
    timedOut: boolean
    failed: boolean
    signal?: NodeJS.Signals | number | undefined
    error?: Error | undefined
}

export interface SpawnOptions {
    /**
     * Name of the terminal to be set in environment ($TERM variable).
     * @defaultValue `xterm`
     */
    term?: string

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
     * Whether the child process env should extend from `process.env`;
     * @defaultValue `true`
     */
    extendEnv?: boolean

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

    /**
     * Windows only passed to `node-pty` concerning whether to use ConPTY over WinPTY.
     * Added as a workaround until {@link https://github.com/microsoft/node-pty/issues/437} is resolved
     * @defaultValue `false`
     */
    useConpty?: boolean
}

export const colorEnv = {
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
};

export class SpawnStream extends RecordingStream {
    cwd: string;

    env: Env;

    constructor(cwd: string, env: Env) {
        super();
        this.cwd = cwd;
        this.env = env;
    }
}

/**
 * Resolve the absolute path of the command to run - implementation draws heavily from `cross-spawn`:
 * {@link https://github.com/moxystudio/node-cross-spawn/blob/master/lib/util/resolveCommand.js}
 * @param command - command to run
 * @param cwd - directory to run command in
 * @returns resolved command file path
 */
function resolveCommand(command: string, cwd: string) {
    // get the current working directory
    const thisCwd = process.cwd();
    // change to specified cwd if necessary
    if (cwd !== thisCwd) {
        try {
            process.chdir(cwd);
        } catch {}
    }
    // extract PATH from env
    const PATH = process.env[
        process.platform !== 'win32' ? 'PATH'
            : Object.keys(process.env).reverse().find((key) => key.toUpperCase() === 'PATH') ?? 'Path'
    ];
    // resolve command file path with `which`
    let resolved;
    try {
        resolved = which.sync(command, { path: PATH });
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

export default function readableSpawn(command: string, args: string[], {
    columns,
    rows,
    term = 'xterm',
    cwd = process.cwd(),
    env: envOption,
    extendEnv = true,
    timeout = 0,
    killSignal = 'SIGTERM',
    useConpty = false,
}: Dimensions & SpawnOptions) {
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
    // resolve env
    const env = { ...(extendEnv ? { ...process.env, ...envOption } : { ...envOption }), ...colorEnv },
        // create recording source stream
        stream = new SpawnStream(cwd, env),
        // resolve command
        file = resolveCommand(command, cwd),
        // create pty child process
        spawned = pty.spawn(file, args, {
            cols: columns,
            rows,
            name: term,
            env,
            cwd,
            useConpty,
        });
    // emit stream start event
    stream.start([command, ...args.map((arg) => (
        (!arg.length || /^[\w.-]+$/.test(arg)) ? arg : `"${arg.replace(/"/g, '\\"')}"`
    ))].join(' '));
    // attach data listener
    const dataHook = spawned.onData((chunk: string) => {
        stream.write(chunk.replace(/\r\n/g, '\n'));
    });
    // track if child process has been killed
    let killed = false,
        // exit code for spawn result
        exitCode: number | undefined,
        // signal for spawn result
        signal: NodeJS.Signals | number | undefined;
    // create spawn promise
    const spawnPromise = new Promise<SpawnResult>((resolve) => {
        const exitHook = spawned.onExit((event) => {
            // dispose of hooks
            dataHook.dispose();
            exitHook.dispose();
            // kill spawned process to prevent hanging on windows
            if (!killed) {
                killed = true;
                spawned.kill();
            }
            // update exit code & signal
            exitCode ??= event.exitCode;
            signal ??= ((event.signal && signals.find(([, n]) => n === event.signal)) || [])[0] ?? event.signal;
            // resolve spawn result
            resolve({
                exitCode,
                signal,
                timedOut: false,
                failed: exitCode !== 0 || !!signal,
            });
        });
    });
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
                    if (!killed) {
                        killed = true;
                        // set exit code & signal
                        exitCode = 1;
                        signal = killSignal;
                        // kill spawned process
                        spawned.kill(process.platform !== 'win32' ? killSignal : undefined);
                    }
                    // reject to end the race
                    reject(new Error('Timed out'));
                }, timeout);
            }),
            promise.finally(() => {
                clearTimeout(timeoutId);
            }),
        ]).catch<SpawnResult>((error: Error) => spawnPromise.then((result) => ({
            ...result,
            timedOut: true,
            error,
        })));
    }
    // add signal-exit handler
    const cleanupExitHandler = onExit((code, sig) => {
        if (!killed) {
            killed = true;
            // set exit code & signal
            exitCode ??= code ?? 1;
            if (sig) signal ??= sig as NodeJS.Signals;
            // kill spawned process
            spawned.kill(process.platform !== 'win32' ? (sig ?? undefined) : undefined);
        }
    });
    // cleanup exit handler
    promise = promise.finally(() => {
        cleanupExitHandler();
    });
    // finally, invoke stream.finish
    promise = promise.then((result) => {
        stream.finish({ result });
        return result;
    });
    // merge source stream and promise chain
    return mergePromise(stream, promise);
}