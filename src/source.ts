import { Readable } from 'stream';

export interface StartEvent {
    type: 'start'
    timestamp: number
    command?: string
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
        const content = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : typeof chunk === 'string' ? chunk : '';
        // ignore empty writes
        if (!content) return;
        // push a start event if the source is inactive
        if (!this.active) {
            this.start();
        }
        // push write event
        const event: SourceEvent = {
            type: 'write',
            content,
            timestamp: Date.now(),
            delay,
        };
        this.push(event);
    }

    start(...args: any[]): void
    start(context: Record<string, string> = {}): void {
        if (this.closed) {
            throw new Error('Source stream is closed');
        }
        if (this.active) return;
        this.status = Status.Active;
        const event: StartEvent = {
            type: 'start',
            timestamp: Date.now(),
            ...context,
        };
        this.push(event);
    }

    finish<T>(result?: T) {
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
    }
}