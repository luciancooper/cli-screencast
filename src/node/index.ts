import * as readline from 'readline';
import type { Interface, ReadLineOptions } from 'readline';
import { inspect } from 'util';
import RecordingStream from '../source';
import type { OmitStrict, TerminalOptions, CommandOptions } from '../types';
import { applyDefCommandOptions } from '../options';
import { restoreProperty, promisifyStream, mergePromise } from '../utils';
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

export interface NodeCapture {
    /**
     * The column width of the recording terminal window
     */
    columns: number

    /**
     * The row height of the recording terminal window
     */
    rows: number

    /**
     * The input stream for the terminal recording capture.
     */
    readonly input: InputStream

    /**
     * Start the capture, optionally passing a command prompt string to include in the beginning of the capture.
     * @param command - command prompt string
     */
    start: (command?: string) => void

    /**
     * Finish the capture, optionally passing in an error to display at the end of the recording.
     * @param error - error to display at the end of the captured recording
     */
    finish: (error?: Error) => void

    /**
     * Write data to the terminal recording to be captured.
     * @param chunk - content to write
     */
    write: (chunk: any) => boolean

    /**
     * Do a final write to the terminal recording and then close the capture.
     * @param chunk - content of final write
     */
    end: (chunk: any) => void

    /**
     * Artificially wait a number of milliseconds in the capture recording.
     * @param milliseconds - milliseconds to wait
     */
    wait: (milliseconds: number) => void

    /**
     * Set the title / icon of the terminal window in the recorded capture.
     * @param title - window title string or object with window title / icon strings
     */
    setTitle: (title: string | { title?: string, icon?: string }) => void

    /**
     * Artificially emit a keypress to the recording's input stream during the capture.
     * @param key - keypress to emit
     */
    emitKeypress: (key: string) => Promise<void>

    /**
     * Artificially emit a sequence of keypresses to the recording's input stream during the capture.
     * @param string - keypresses to emit
     */
    emitKeypressSequence: (string: string | string[]) => Promise<void>

    /**
     * Create an interface to implement command-line interfaces to be captured in the recording. Works just like the
     * [`readline.createInterface`](https://nodejs.org/api/readline.html#readlinecreateinterfaceoptions) method
     * that is built into node.
     * @param options - the same options as `readline.createInterface` except for `input`, `tabSize`, `terminal`.
     * @returns a [`readline.Interface`](https://nodejs.org/api/readline.html#class-readlineinterface) instance
     */
    createInterface: (options?: OmitStrict<ReadLineOptions, 'input' | 'tabSize' | 'terminal'>) => Interface

    /**
     * Not yet implemented
     * @experimental
     */
    resize: (columns: number, rows: number) => void
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

export interface NodeRecordingStreamOptions
    extends TerminalOptions, CallbackOptions, Pick<CommandOptions, 'keystrokeAnimationInterval'> {}

export class NodeRecordingStream<T> extends RecordingStream<T> implements NodeCapture {
    isTTY = true;

    private targetDescriptors: TargetDescriptors | null = null;

    readonly input: InputStream;

    silent: boolean;

    keystrokeAnimationInterval: number;

    constructor({ connectStdin = false, silent = true, ...options }: NodeRecordingStreamOptions) {
        super(options);
        // apply default command options
        const { keystrokeAnimationInterval } = applyDefCommandOptions(options);
        // set options
        this.silent = silent;
        this.keystrokeAnimationInterval = keystrokeAnimationInterval;
        // setup input stream
        this.input = new InputStream(connectStdin);
    }

    get stdioHooked(): boolean {
        return !!this.targetDescriptors;
    }

    handleCallbackError(error: Error): void {
        // stop if stream is destroyed
        if (this.destroyed) return;
        if (!this.ended) {
            // stream has not finished, so error can be captured
            this.finish(error);
            this.resume();
        } else {
            // stream has already finished so this error will destroy the stream
            this.destroy(error);
        }
    }

    /**
     * Resizes the dimensions of the recording terminal window
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

    restoreStreams(errorString?: string) {
        if (!this.targetDescriptors) return;
        const { stdout, stderr, stdin } = this.targetDescriptors;
        this.restoreOutputStream(process.stdout, stdout);
        this.restoreOutputStream(process.stderr, stderr);
        restoreProperty(process, 'stdin', stdin);
        this.input.unhook();
        this.targetDescriptors = null;
        if (!this.silent) {
            if (errorString) process.stderr.write(errorString);
            process.stdout.write(NodeRecordingStream.kCaptureEndLine);
        }
    }

    override start(command?: string) {
        super.start(command);
        this.hookStreams();
    }

    override _destroy(error: Error | null, callback: (e: Error | null) => void) {
        // restore the hooked streams. This is neccessary to handle edge case
        // where `destroy` is called on the stream within the callback
        this.restoreStreams();
        callback(error);
    }

    override finish(error?: Error) {
        if (this.ended && error) {
            this.destroy(error);
            throw error;
        }
        const errorString = error ? `${inspect(error, { colors: true })}\n` : undefined;
        // finish stream
        super.finish(errorString);
        // restore streams
        this.restoreStreams(errorString);
    }
}

export default function readableCallback<T>(
    fn: (capture: NodeCapture) => Promise<T> | T,
    options: NodeRecordingStreamOptions,
    ac: AbortController,
) {
    // create node recording stream
    const stream = new NodeRecordingStream<T>(options),
        // wrap callback in a promise and defer execution until next tick
        // this allows setup to be completed if callback is synchronous.
        callbackPromise = new Promise<void>((resolve) => {
            process.nextTick(() => {
                // hook streams
                stream.hookStreams();
                // run callback
                (async () => fn(stream))().then((result) => {
                    stream.setResult(result);
                }, (error: Error) => {
                    stream.handleCallbackError(error);
                }).then(resolve);
            });
        });
    // merge source stream and promise chain
    return mergePromise(stream, Promise.all([
        callbackPromise,
        promisifyStream(stream, ac),
    ]).then(() => {}));
}