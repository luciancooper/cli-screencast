import * as readline from 'readline';
import type { Interface, ReadLineOptions } from 'readline';
import { inspect } from 'util';
import RecordingStream from '../source';
import type { OmitStrict, TerminalOptions } from '../types';
import { type CaptureOptions, defaultCaptureOptions } from '../capture';
import { applyDefaults } from '../options';
import { restoreProperty, mergePromise } from '../utils';
import InputStream from './input';

export interface CallbackOptions {
    /**
     * Connect capture session to `process.stdin` to capture any input from the user.
     * @defaultValue `false`
     */
    connectStdin?: boolean

    /**
     * Silently capture output to `process.stdout` and `process.stderr`.
     * @defaultValue `true`
     */
    silent?: boolean
}

interface OutputStreamDescriptors {
    columns: PropertyDescriptor | undefined
    rows: PropertyDescriptor | undefined
    props: (readonly [key: string, desc: PropertyDescriptor | undefined])[]
}

interface TargetDescriptors {
    stdout: OutputStreamDescriptors
    stderr: OutputStreamDescriptors
    stdin: PropertyDescriptor | undefined
}

interface SocketHandle {
    getWindowSize?: (arr: [cols: number, rows: number]) => Error | null
}

type Options = TerminalOptions & CallbackOptions & Pick<CaptureOptions, 'keystrokeAnimationInterval'>;

export class NodeRecordingStream extends RecordingStream {
    isTTY = true;

    private targetDescriptors: TargetDescriptors | null = null;

    readonly input: InputStream;

    silent: boolean;

    keystrokeAnimationInterval: number;

    constructor(options: Options) {
        super(options);
        // apply defaults
        const { connectStdin, silent, keystrokeAnimationInterval } = applyDefaults({
            connectStdin: false,
            silent: true,
            keystrokeAnimationInterval: defaultCaptureOptions.keystrokeAnimationInterval,
        }, options);
        // set options
        this.silent = silent;
        this.keystrokeAnimationInterval = keystrokeAnimationInterval;
        // setup input stream
        this.input = new InputStream(connectStdin);
    }

    /**
     * Resizes the dimensions of the output terminal window
     * @param columns - The number of columns to resize to
     * @param rows - The number of rows to resize to
     */
    resize(columns: number, rows: number) {
        if (this.columns !== columns || this.rows !== rows) {
            this.columns = columns;
            this.rows = rows;
            process.stdout.emit('resize');
            process.stderr.emit('resize');
        }
    }

    emitKeypress(key: string): Promise<void> {
        return new Promise((resolve) => {
            this.input.writeKey(key);
            process.nextTick(resolve);
        });
    }

    emitKeypressSequence(string: string | string[]): Promise<void> {
        const keys = typeof string === 'string' ? [...string] : string;
        return keys.reduce<Promise<void>>((p, key) => p.then(() => {
            this.wait(this.keystrokeAnimationInterval);
            return this.emitKeypress(key);
        }), Promise.resolve());
    }

    createInterface(options: OmitStrict<ReadLineOptions, 'input' | 'tabSize' | 'terminal'> = {}): Interface {
        return readline.createInterface({
            output: process.stdout,
            ...options,
            input: this.input,
            tabSize: this.context.tabSize,
            terminal: true,
        });
    }

    private outputStreamDescriptors(stream: NodeJS.WriteStream, tty: boolean): OutputStreamDescriptors {
        let keys = ['write', '_refreshSize', 'getColorDepth', 'hasColors'];
        if (!tty) keys = [...keys, 'isTTY', 'cursorTo', 'moveCursor', 'clearLine', 'clearScreenDown', 'getWindowSize'];
        return {
            columns: Object.getOwnPropertyDescriptor(stream, 'columns'),
            rows: Object.getOwnPropertyDescriptor(stream, 'rows'),
            props: keys.map((key) => [key, Object.getOwnPropertyDescriptor(stream, key)]),
        };
    }

    private hookOutputStream(stream: NodeJS.WriteStream, tty: boolean) {
        // replace stream.columns with hooked getter
        Object.defineProperty(stream, 'columns', { get: () => this.columns, configurable: true });
        // replace stream.rows with hooked getter
        Object.defineProperty(stream, 'rows', { get: () => this.rows, configurable: true });
        // set a dummy `_refreshSize` dummy method to stream to block calls to `_refreshSize` prototype
        (stream as { _refreshSize?: () => void })._refreshSize = () => {};
        // hook stream.write method
        const writeFn = stream.write;
        stream.write = (chunk: any, enc?: BufferEncoding | (() => void), cb?: () => void): boolean => {
            const [encoding, callback] = (typeof enc === 'function') ? [undefined, enc] : [enc, cb],
                content = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : typeof chunk === 'string' ? chunk : '';
            if (!this.silent) writeFn.call(stream, chunk, encoding, callback);
            return this.write(content, encoding, callback);
        };
        // hook stream.getColorDepth method
        stream.getColorDepth = () => 24; // full color support (16,777,216 colors)
        // hook stream.hasColors method
        stream.hasColors = (count?: number | object) => (typeof count === 'number' ? count <= 2 ** 24 : true);
        // add tty stream specific methods if output stream is not TTY
        if (!tty) {
            stream.isTTY = true;
            stream.cursorTo = (...args) => readline.cursorTo(this, ...args as [number, number | undefined]);
            stream.clearLine = (...args) => readline.clearLine(this, ...args);
            stream.clearScreenDown = (...args) => readline.clearScreenDown(this, ...args);
            stream.moveCursor = (...args) => readline.moveCursor(this, ...args);
            stream.getWindowSize = () => [this.columns, this.rows];
        }
    }

    private restoreOutputStream(stream: NodeJS.WriteStream, descriptors: OutputStreamDescriptors): void {
        const size = new Array(2) as [cols: number, rows: number];
        let { columns, rows } = descriptors;
        // get current window size from `stream._handle`
        const { _handle } = (stream as unknown as { _handle?: SocketHandle });
        if (columns && rows && _handle && typeof _handle.getWindowSize === 'function' && !_handle.getWindowSize(size)) {
            columns = { ...columns, value: size[0] };
            rows = { ...rows, value: size[1] };
        }
        // restore `columns` and `rows` properties
        restoreProperty(stream, 'columns', columns);
        restoreProperty(stream, 'rows', rows);
        // restore all additional props
        for (const [key, descriptor] of descriptors.props) {
            restoreProperty(stream, key as keyof typeof stream, descriptor);
        }
    }

    hookStreams() {
        if (this.targetDescriptors) return;
        if (!this.silent) process.stdout.write(NodeRecordingStream.kCaptureStartLine);
        const stdoutTTY = process.stdout.isTTY,
            stderrTTY = process.stderr.isTTY;
        this.targetDescriptors = {
            stdout: this.outputStreamDescriptors(process.stdout, stdoutTTY),
            stderr: this.outputStreamDescriptors(process.stderr, stderrTTY),
            stdin: Object.getOwnPropertyDescriptor(process, 'stdin'),
        };
        this.hookOutputStream(process.stdout, stdoutTTY);
        this.hookOutputStream(process.stderr, stderrTTY);
        this.input.hook();
        Object.defineProperty(process, 'stdin', { value: this.input, configurable: true, writable: false });
    }

    override start(command?: string) {
        super.start(command);
        this.hookStreams();
    }

    override finish(error?: Error) {
        const err = error ? `${inspect(error, { colors: true })}\n` : undefined;
        super.finish(err);
        // restore streams
        if (!this.targetDescriptors) return;
        const { stdout, stderr, stdin } = this.targetDescriptors;
        this.restoreOutputStream(process.stdout, stdout);
        this.restoreOutputStream(process.stderr, stderr);
        restoreProperty(process, 'stdin', stdin);
        this.input.unhook();
        this.targetDescriptors = null;
        if (!this.silent) {
            if (err) process.stderr.write(err);
            process.stdout.write(NodeRecordingStream.kCaptureEndLine);
        }
    }
}

export type RunCallback<T> = (source: NodeRecordingStream) => Promise<T> | T;

export default function callbackStream<T = any>(fn: RunCallback<T>, options: Options) {
    // create node recording stream
    const stream = new NodeRecordingStream(options);
    // wrap callback in a promise and defer execution until next tick
    // this allows setup to be completed if callback is synchronous.
    let promise = new Promise<T | null>((resolve, reject) => {
        process.nextTick(() => {
            // hook streams
            stream.hookStreams();
            // run callback
            (async () => fn(stream))().then(resolve, reject);
        });
    });
    promise = promise.then((result) => {
        if (!stream.ended) stream.finish();
        return result;
    }, (error: Error) => {
        // if error was caught during recording, it will be included in the capture
        if (!stream.ended) {
            stream.finish(error);
            return null;
        }
        // otherwise it will be rethrown and kill the capture
        throw error;
    });
    // merge source stream and promise chain
    return mergePromise(stream, promise);
}