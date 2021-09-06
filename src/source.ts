import { Readable } from 'stream';

export interface StartEvent {
    type: 'start'
    timestamp: number
    context?: unknown
}

export interface WriteEvent {
    type: 'write'
    timestamp: number
    content: string
    delay: number
}

export interface FinishEvent {
    type: 'finish'
    timestamp: number
    result?: unknown
}

export type SourceEvent = StartEvent | WriteEvent | FinishEvent;

const enum Status {
    Inactive = 0,
    Active = 1,
    Stopped = 2,
}

export default class RecordingSource extends Readable {
    private status: Status = Status.Inactive;

    constructor() {
        super({ objectMode: true, read: (size: number) => {} });
    }

    get active(): boolean {
        return this.status === Status.Active;
    }

    get closed(): boolean {
        return this.status === Status.Stopped;
    }

    write(chunk: any, delay = 0) {
        if (this.closed) {
            throw new Error('Source stream is closed');
        }
        if (!this.active) {
            this.start();
        }
        const event: SourceEvent = {
            type: 'write',
            content: Buffer.isBuffer(chunk) ? chunk.toString() : typeof chunk === 'string' ? chunk : '',
            timestamp: Date.now(),
            delay,
        };
        this.push(event);
    }

    start<T>(context?: T) {
        if (this.closed) {
            throw new Error('Source stream is closed');
        }
        if (this.active) return;
        this.status = Status.Active;
        const event: StartEvent = {
            type: 'start',
            timestamp: Date.now(),
            context,
        };
        this.push(event);
    }

    finish<T>(result?: T): T {
        if (this.closed) {
            throw new Error('Source stream is closed');
        }
        this.status = Status.Stopped;
        const event: SourceEvent = {
            type: 'finish',
            timestamp: Date.now(),
            result,
        };
        this.push(event);
        this.push(null);
        return result!;
    }
}