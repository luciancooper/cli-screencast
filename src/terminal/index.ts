import * as readline from 'readline';
import type { Interface, ReadLineOptions } from 'readline';
import RecordingStream from '../source';
import type { OmitStrict, Dimensions } from '../types';
import type { CaptureOptions } from '../capture';
import InputStream from './input';
import { restoreProperty } from '../utils';

export interface SessionOptions {
    connectStdin?: boolean
    silent?: boolean
}

export type RunCallback<T> = (source: TerminalRecordingStream) => Promise<T> | T;

interface Options extends Dimensions, SessionOptions, Required<Pick<CaptureOptions, 'keystrokeAnimationInterval'>> {
    tabSize: number
}

interface OutputStreamDescriptors {
    columns: PropertyDescriptor | undefined
    rows: PropertyDescriptor | undefined
    props: (readonly [string, PropertyDescriptor | undefined])[]
}

interface TargetDescriptors {
    stdout: OutputStreamDescriptors
    stderr: OutputStreamDescriptors
    stdin: PropertyDescriptor | undefined
}

interface SocketHandle {
    getWindowSize?: (arr: [number, number]) => Error | null
}

export default class TerminalRecordingStream extends RecordingStream {
    static kCaptureStartLine = '\x1b[36;1m>>>\x1b[39m \x1b[31m●\x1b[39m Capture Start \x1b[36m>>>\x1b[39;22m\n';

    static kCaptureEndLine = '\x1b[36;1m<<<\x1b[39m \x1b[31m■\x1b[39m Capture End \x1b[36m<<<\x1b[39;22m\n';

    isTTY = true;

    private targetDescriptors: TargetDescriptors | null = null;

    readonly input: InputStream;

    columns: number;

    rows: number;

    tabSize: number;

    silent: boolean;

    keystrokeAnimationInterval: number;

    constructor({
        columns,
        rows,
        tabSize,
        keystrokeAnimationInterval,
        connectStdin = false,
        silent = true,
    }: Options) {
        super();
        this.columns = columns;
        this.rows = rows;
        this.tabSize = tabSize;
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
        const { input, tabSize } = this;
        return readline.createInterface({
            output: process.stdout,
            ...options,
            input,
            tabSize,
            terminal: true,
        });
    }

    async run<T = any>(fn: RunCallback<T>): Promise<T> {
        this.hookStreams();
        try {
            const result = await fn(this);
            if (!this.ended) this.finish();
            return result;
        } catch (error: unknown) {
            if (!this.ended) this.finish(error);
            throw error;
        }
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
        const size = new Array(2) as [number, number];
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

    protected hookStreams() {
        if (this.targetDescriptors) return;
        if (!this.silent) process.stdout.write(TerminalRecordingStream.kCaptureStartLine);
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

    protected restoreStreams() {
        if (!this.targetDescriptors) return;
        const { stdout, stderr, stdin } = this.targetDescriptors;
        this.restoreOutputStream(process.stdout, stdout);
        this.restoreOutputStream(process.stderr, stderr);
        restoreProperty(process, 'stdin', stdin);
        this.input.unhook();
        this.targetDescriptors = null;
        if (!this.silent) process.stdout.write(TerminalRecordingStream.kCaptureEndLine);
    }

    override start(command?: string) {
        super.start(command);
        this.hookStreams();
    }

    override finish(error?: unknown) {
        super.finish({ error });
        this.restoreStreams();
    }
}