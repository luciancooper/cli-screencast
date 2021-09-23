import * as readline from 'readline';
import type { Interface, ReadLineOptions } from 'readline';
import RecordingStream from '../source';
import type { OmitStrict, Dimensions } from '../types';
import InputStream from './input';
import { restoreProperty } from '../utils';

export interface SessionOptions {
    connectStdin?: boolean
    silent?: boolean
}

export type RunCallback<T> = (source: TerminalRecordingStream) => Promise<T> | T;

interface Options extends Dimensions, SessionOptions {
    tabSize: number
}

interface OutputStreamDescriptors {
    columns: PropertyDescriptor
    rows: PropertyDescriptor
    write?: PropertyDescriptor
    getColorDepth?: PropertyDescriptor
    hasColors?: PropertyDescriptor
}

interface TargetDescriptors {
    stdout: OutputStreamDescriptors
    stderr: OutputStreamDescriptors
    stdin: PropertyDescriptor
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

    constructor({
        columns,
        rows,
        tabSize,
        connectStdin = false,
        silent = true,
    }: Options) {
        super();
        this.columns = columns;
        this.rows = rows;
        this.tabSize = tabSize;
        this.silent = silent;
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

    emitKeypressSequence(string: string | string[], delayBetween = 500): Promise<void> {
        const keys = typeof string === 'string' ? [...string] : string;
        return keys.reduce<Promise<void>>((p, key) => p.then(() => {
            this.wait(delayBetween);
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

    private outputStreamDescriptors(stream: NodeJS.WriteStream): OutputStreamDescriptors {
        return {
            columns: Object.getOwnPropertyDescriptor(stream, 'columns')!,
            rows: Object.getOwnPropertyDescriptor(stream, 'rows')!,
            write: Object.getOwnPropertyDescriptor(stream, 'write'),
            getColorDepth: Object.getOwnPropertyDescriptor(stream, 'getColorDepth'),
            hasColors: Object.getOwnPropertyDescriptor(stream, 'hasColors'),
        };
    }

    private hookOutputStream(stream: NodeJS.WriteStream) {
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
    }

    private restoreOutputStream(stream: NodeJS.WriteStream, descriptors: OutputStreamDescriptors): void {
        const size = new Array(2) as [number, number];
        let { columns, rows } = descriptors;
        // get current window size from `stream._handle`
        const { _handle } = (stream as unknown as { _handle?: SocketHandle });
        if (_handle && typeof _handle.getWindowSize === 'function' && !_handle.getWindowSize(size)) {
            columns = { ...columns, value: size[0] };
            rows = { ...rows, value: size[1] };
        }
        // restore `columns` and `rows` properties
        Object.defineProperty(stream, 'columns', columns);
        Object.defineProperty(stream, 'rows', rows);
        // delete dummy `_refreshSize` method from stream
        delete (stream as { _refreshSize?: () => void })._refreshSize;
        // restore stream `write` method
        restoreProperty(stream, 'write', descriptors.write);
        // restore stream `getColorDepth` method
        restoreProperty(stream, 'getColorDepth', descriptors.getColorDepth);
        // restore stream `hasColors` method
        restoreProperty(stream, 'hasColors', descriptors.hasColors);
    }

    protected hookStreams() {
        if (this.targetDescriptors) return;
        if (!this.silent) process.stdout.write(TerminalRecordingStream.kCaptureStartLine);
        this.targetDescriptors = {
            stdout: this.outputStreamDescriptors(process.stdout),
            stderr: this.outputStreamDescriptors(process.stderr),
            stdin: Object.getOwnPropertyDescriptor(process, 'stdin')!,
        };
        this.hookOutputStream(process.stdout);
        this.hookOutputStream(process.stderr);
        this.input.hook();
        Object.defineProperty(process, 'stdin', { value: this.input, configurable: true, writable: false });
    }

    protected restoreStreams() {
        if (!this.targetDescriptors) return;
        const { stdout, stderr, stdin } = this.targetDescriptors;
        this.restoreOutputStream(process.stdout, stdout);
        this.restoreOutputStream(process.stderr, stderr);
        Object.defineProperty(process, 'stdin', stdin);
        this.input.unhook();
        this.targetDescriptors = null;
        if (!this.silent) process.stdout.write(TerminalRecordingStream.kCaptureEndLine);
    }

    override start() {
        super.start();
        this.hookStreams();
    }

    override finish(error?: unknown) {
        super.finish({ error });
        this.restoreStreams();
    }
}