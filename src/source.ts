import { Duplex } from 'stream';

export interface StartEvent {
    type: 'start'
    timestamp: number
    command?: string
}

export interface WriteEvent {
    type: 'write'
    timestamp: number
    content: string
}

export interface WaitEvent {
    type: 'wait'
    milliseconds: number
}

export interface FinishEvent {
    type: 'finish'
    timestamp: number
    result?: unknown
    error?: unknown
}

export type SourceEvent = StartEvent | WriteEvent | WaitEvent | FinishEvent;

export default class RecordingStream extends Duplex {
    private started = false;

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

    get ended(): boolean {
        return ((this as { _readableState?: { ended: boolean } })._readableState!).ended;
    }

    override _read() {}

    override _write(chunk: Buffer | string, enc: BufferEncoding, cb: (error?: Error | null) => void): void {
        if (this.ended) {
            return void cb(new Error('Source stream is closed'));
        }
        const content = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk;
        // only push non-empty writes
        if (content) {
            // push a start event if the source is inactive
            if (!this.started) this.start();
            // push write event
            const event: SourceEvent = {
                type: 'write',
                content,
                timestamp: Date.now(),
            };
            this.push(event);
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
        // push wait event
        const event: SourceEvent = {
            type: 'wait',
            milliseconds,
        };
        this.push(event);
    }

    start(...args: any[]): void
    start(context: Record<string, string> = {}): void {
        if (this.ended) {
            throw new Error('Source stream is closed');
        }
        if (this.started) return;
        this.started = true;
        const event: StartEvent = {
            type: 'start',
            timestamp: Date.now(),
            ...context,
        };
        this.push(event);
        this.emit('recording-start', event.timestamp);
    }

    finish({ result, error }: { result?: unknown, error?: unknown } = {}): void {
        if (this.ended) {
            throw new Error('Source stream is closed');
        }
        const event: SourceEvent = {
            type: 'finish',
            timestamp: Date.now(),
            error,
            result,
        };
        this.push(event);
        this.push(null);
        this.emit('recording-end', event.timestamp);
    }

    setTitle(title: string, icon: string | boolean = false) {
        if (this.ended) {
            throw new Error('Source stream is closed');
        }
        // push an initial start event to the readable stream if necessary
        if (!this.started) this.start();
        // push write event
        const event: SourceEvent = {
            type: 'write',
            content: typeof icon === 'string'
                ? `\x1b]2;${title}\x07\x1b]1;${icon}\x07`
                : `\x1b]${icon ? 0 : 2};${title}\x07`,
            timestamp: Date.now(),
        };
        this.push(event);
    }
}