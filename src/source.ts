import { Duplex, type DuplexOptions } from 'stream';
import type { Frame } from './types';

export interface StartEvent {
    type: 'start'
    command?: string | undefined
}

interface EventTime {
    time: number
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
    private started = false;

    private startTime = NaN;

    private timeAdjustment = 0;

    constructor() {
        super({
            decodeStrings: false,
            allowHalfOpen: false,
            writableObjectMode: false,
            readableObjectMode: true,
            writableHighWaterMark: 65536,
            readableHighWaterMark: 1000,
        });
    }

    static fromFrames(frames: Frame[]): RecordingStream {
        const stream = new RecordingStream();
        stream.push({ type: 'start' });
        let time = 0;
        for (const { content, duration } of frames) {
            stream.push({ time, content });
            time += duration;
        }
        stream.push({ type: 'finish', time });
        stream.push(null);
        return stream;
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
        this.push({ type: 'start', command });
        this.emit('recording-start', this.startTime);
    }

    finish({ result, error }: { result?: unknown, error?: unknown } = {}): void {
        if (this.ended) {
            throw new Error('Source stream is closed');
        }
        const time = this.started ? Date.now() - this.startTime : 0;
        this.push({
            type: 'finish',
            time,
            adjustment: this.timeAdjustment,
            error,
            result,
        });
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