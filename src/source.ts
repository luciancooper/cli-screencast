import { Duplex, type DuplexOptions } from 'stream';
import type { TerminalOptions, PickOptional } from './types';
import { applyDefTerminalOptions } from './options';

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
    result?: unknown
    error?: unknown
}

export type SourceEvent = StartEvent | WriteEvent | FinishEvent;

interface TypedDuplex extends Duplex {
    push: (chunk: SourceEvent | null) => boolean
}

const DuplexConstructor: new(opts?: DuplexOptions | undefined) => TypedDuplex = Duplex;

export default class RecordingStream extends DuplexConstructor {
    static kCaptureStartLine = '\x1b[36;1m>>>\x1b[39m \x1b[31m●\x1b[39m Capture Start \x1b[36m>>>\x1b[39;22m\n';

    static kCaptureEndLine = '\x1b[36;1m<<<\x1b[39m \x1b[31m■\x1b[39m Capture End \x1b[36m<<<\x1b[39;22m\n';

    columns: number;

    rows: number;

    context: Required<PickOptional<TerminalOptions>>;

    private started = false;

    private startTime = NaN;

    private timeAdjustment = 0;

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

    static fromFrames(opts: TerminalOptions, frames: SourceFrame[]): RecordingStream {
        const stream = new RecordingStream(opts);
        stream.push({ type: 'start', ...stream.termOptions });
        let time = 0;
        for (const { content, duration } of frames) {
            stream.push({ time, content });
            time += duration;
        }
        stream.push({ type: 'finish', time });
        stream.push(null);
        return stream;
    }

    get termOptions(): Required<TerminalOptions> {
        const { columns, rows, context } = this;
        return { columns, rows, ...context };
    }

    get ended(): boolean {
        return ((this as { _readableState?: { ended: boolean } })._readableState!).ended;
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
            cb(new Error('Source stream is closed'));
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
            throw new Error('Source stream is closed');
        }
        // push an initial start event to the readable stream if necessary
        if (!this.started) this.start();
        // add to accumulated time adjustment
        this.timeAdjustment += milliseconds;
    }

    start(command?: string): void {
        if (this.ended) {
            throw new Error('Source stream is closed');
        }
        if (this.started) return;
        this.started = true;
        this.startTime = Date.now();
        // create start event
        this.push({ type: 'start', command, ...this.termOptions });
        this.emit('recording-start', this.startTime);
    }

    finish({ result, error }: { result?: unknown, error?: unknown } = {}): void {
        if (this.ended) {
            throw new Error('Source stream is closed');
        }
        const time = this.started ? Date.now() - this.startTime : 0;
        // emit start event if stream has not started
        if (!this.started) this.start();
        // push finish event
        this.push({
            type: 'finish',
            time,
            adjustment: this.timeAdjustment,
            error,
            result,
        });
        // reset time adjustment
        this.timeAdjustment = 0;
        this.push(null);
        this.emit('recording-end', time);
    }

    setTitle(title: string, icon: string | boolean = false) {
        if (this.ended) {
            throw new Error('Source stream is closed');
        }
        // push an initial start event to the readable stream if necessary
        if (!this.started) this.start();
        // push write event
        this.pushWrite(
            typeof icon === 'string'
                ? `\x1b]2;${title}\x07\x1b]1;${icon}\x07`
                : `\x1b]${icon ? 0 : 2};${title}\x07`,
        );
    }
}