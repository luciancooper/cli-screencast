import * as pty from 'node-pty';
import { constants } from 'os';
import path from 'path';
import which from 'which';
import onExit from 'signal-exit';
import type { Dimensions } from './types';
import RecordingSource from './source';
import { mergePromise } from './utils';

const signals = Object.entries(constants.signals) as (readonly [NodeJS.Signals, number])[];

type Env = Record<string, string>;

export interface SpawnResult {
    exitCode: number
    timedOut: boolean
    killed: boolean
    failed: boolean
    signal?: NodeJS.Signals | number
    error?: Error
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
}

export const colorEnv = {
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
};

export class SpawnRecordingSource extends RecordingSource {
    cwd: string;

    env: Env;

    constructor(cwd: string, env: Env) {
        super();
        this.cwd = cwd;
        this.env = env;
    }

    override start(command: string, args: string[]) {
        super.start({
            command: [command, ...args.map((arg) => (
                (!arg.length || /^[\w.-]+$/.test(arg)) ? arg : `"${arg.replace(/"/g, '\\"')}"`
            ))].join(' '),
        });
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
    if (resolved) resolved = path.resolve((thisCwd !== cwd) ? cwd : '', resolved);
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
        stream = new SpawnRecordingSource(cwd, env),
        // resolve command
        file = resolveCommand(command, cwd),
        // create pty child process
        spawned = pty.spawn(file, args, {
            cols: columns,
            rows,
            name: term,
            env,
            cwd,
        });
    // emit stream start event
    stream.start(command, args);
    // attach data listener
    const dataHook = spawned.onData((chunk: string) => {
        stream.write(chunk.replace(/\r\n/g, '\n'), 0);
    });
    // track if child process has been killed
    let killed = false;
    // create spawn promise
    const spawnPromise = new Promise<SpawnResult>((resolve) => {
        const exitHook = spawned.onExit(({ exitCode, signal }) => {
            dataHook.dispose();
            exitHook.dispose();
            resolve({
                exitCode,
                signal: ((signal && signals.find(([, n]) => n === signal)) || [])[0] ?? signal,
                killed,
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
                    killed = true;
                    spawned.kill(process.platform !== 'win32' ? killSignal : undefined);
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
    const cleanupExitHandler = onExit(() => {
        spawned.kill();
        killed = true;
    });
    // cleanup exit handler
    promise = promise.finally(() => {
        cleanupExitHandler();
    });
    // finally, invoke stream.finish
    promise = promise.then((result) => {
        stream.finish(result);
        return result;
    });
    // merge source stream and promise chain
    return mergePromise(stream, promise);
}