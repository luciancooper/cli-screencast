import { Duplex, Readable, type DuplexOptions } from 'stream';
import type { TerminalOptions, PickOptional } from './types';
import { applyDefTerminalOptions } from './options';
import { promisifyStream, mergePromise } from './utils';

export interface SourceFrame {
    content: string
    duration: number
}

export interface StartEvent extends Required<TerminalOptions> {
    type: 'start'
    command?: string | undefined
}

interface EventTime {
    /**
     * ms after the source stream started
     */
    time: number
    /**
     * ms to add to the time due to artifical time adjustments
     */
    adjustment?: number
}

export interface WriteEvent extends EventTime {
    type?: never
    content: string
}

export interface FinishEvent extends EventTime {
    type: 'finish'
    content?: unknown
}

export type SourceEvent = StartEvent | WriteEvent | FinishEvent;

interface TypedDuplex extends Duplex {
    push: (chunk: SourceEvent | null) => boolean
}

const DuplexConstructor: new(opts?: DuplexOptions | undefined) => TypedDuplex = Duplex;

export default class RecordingStream<T> extends DuplexConstructor {
    static kCaptureStartLine = '\x1b[36;1m>>>\x1b[39m \x1b[31m●\x1b[39m Capture Start \x1b[36m>>>\x1b[39;22m\n';

    static kCaptureEndLine = '\x1b[36;1m<<<\x1b[39m \x1b[31m■\x1b[39m Capture End \x1b[36m<<<\x1b[39;22m\n';

    columns: number;

    rows: number;

    context: Required<PickOptional<TerminalOptions>>;

    private started = false;

    private startTime = NaN;

    private timeAdjustment = 0;

    result: T | undefined = undefined;

    constructor(options: TerminalOptions) {
        super({
            decodeStrings: false,
            allowHalfOpen: false,
            writableObjectMode: false,
            readableObjectMode: true,
            writableHighWaterMark: 65536,
            readableHighWaterMark: 1000,
        });
        const { columns, rows, ...context } = applyDefTerminalOptions(options);
        this.columns = columns;
        this.rows = rows;
        this.context = context;
    }

    get termOptions(): Required<TerminalOptions> {
        const { columns, rows, context } = this;
        return { columns, rows, ...context };
    }

    get ended(): boolean {
        return ((this as { _readableState?: { ended: boolean } })._readableState!).ended;
    }

    setResult(result: T) {
        // store result
        this.result = result;
        // stop if stream is destroyed
        if (this.destroyed) return;
        // finish the stream if neccessary
        if (!this.ended) this.finish();
        // resume the paused stream so final events can be read
        this.resume();
    }

    private pushWrite(content: string) {
        this.push({
            content,
            time: Date.now() - this.startTime,
            adjustment: this.timeAdjustment,
        });
        // reset time adjustment
        this.timeAdjustment = 0;
    }

    override _read() {}

    override _write(chunk: Buffer | string, enc: BufferEncoding, cb: (error?: Error | null) => void): void {
        if (this.ended) {
            cb(new Error('Invalid write, source stream has been closed'));
            return;
        }
        const content = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk;
        // only push non-empty writes
        if (content) {
            // push a start event if the source is inactive
            if (!this.started) this.start();
            // push write event
            this.pushWrite(content);
        }
        cb();
    }

    override _final(cb: (error?: Error | null) => void): void {
        if (!this.ended) this.finish();
        cb();
    }

    wait(milliseconds: number): void {
        if (this.ended) {
            const error = new Error("Cannot use 'wait' after source stream has been closed");
            this.destroy(error);
            throw error;
        }
        // push an initial start event to the readable stream if necessary
        if (!this.started) this.start();
        // add to accumulated time adjustment
        this.timeAdjustment += milliseconds;
    }

    start(command?: string): void {
        if (this.ended) {
            const error = new Error("Cannot use 'start' after source stream has been closed");
            this.destroy(error);
            throw error;
        }
        if (this.started) return;
        this.started = true;
        this.startTime = Date.now();
        // create start event
        this.push({ type: 'start', command, ...this.termOptions });
        this.emit('recording-start', this.startTime);
    }

    finish(content?: unknown): void {
        if (this.ended) {
            const error = new Error("Cannot use 'finish' after source stream has been closed");
            this.destroy(error);
            throw error;
        }
        const time = this.started ? Date.now() - this.startTime : 0;
        // emit start event if stream has not started
        if (!this.started) this.start();
        // pause the stream
        this.pause();
        // push finish event
        this.push({
            type: 'finish',
            time,
            adjustment: this.timeAdjustment,
            content,
        });
        // reset time adjustment
        this.timeAdjustment = 0;
        this.push(null);
        this.emit('recording-end', time);
    }

    setTitle(arg: string | { title?: string, icon?: string }) {
        if (this.ended) {
            const error = new Error("Cannot use 'setTitle' after source stream has been closed");
            this.destroy(error);
            throw error;
        }
        // determine escape to write
        let esc = '';
        if (typeof arg !== 'string') {
            const { title, icon } = arg ?? {};
            if (typeof title === 'string') esc += `\x1b]2;${title}\x07`;
            if (typeof icon === 'string') esc += `\x1b]1;${icon}\x07`;
        } else esc = `\x1b]2;${arg}\x07`;
        // stop if there is no escape to write
        if (!esc) return;
        // push an initial start event to the readable stream if necessary
        if (!this.started) this.start();
        // push write event
        this.pushWrite(esc);
    }
}

/**
 * Convert an array of source frames in to an array of source events
 */
export function framesToEvents(options: TerminalOptions, frames: SourceFrame[]): SourceEvent[] {
    const events: SourceEvent[] = [
        { type: 'start', ...applyDefTerminalOptions(options) },
    ];
    let time = 0;
    for (const { content, duration } of frames) {
        events.push({ time, content });
        time += duration;
    }
    events.push({ type: 'finish', time });
    return events;
}

/**
 * Create a readable source stream from an array of events
 */
export function readableEvents(events: SourceEvent[], ac: AbortController) {
    const eventIterator = events[Symbol.iterator](),
        // create read stream
        stream = new Readable({
            objectMode: true,
            read() {
                const next = eventIterator.next();
                this.push(next.done ? null : next.value);
            },
        }),
        // promisify stream
        promise = promisifyStream(stream, ac);
    // merge stream into promise
    return mergePromise(stream, promise);
}

/**
 * Create a readable source stream from an array of source frames
 */
export function readableFrames(options: TerminalOptions, frames: SourceFrame[], ac: AbortController) {
    const events = framesToEvents(options, frames);
    return readableEvents(events, ac);
}