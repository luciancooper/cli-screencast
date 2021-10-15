import { Writable, Readable } from 'stream';

class WritableObjectStream<T> extends Writable {
    public data: T[] = [];

    constructor() {
        super({ objectMode: true });
    }

    override _write(chunk: T, enc: BufferEncoding, cb: (error?: Error | null) => void) {
        this.data.push(chunk);
        cb();
    }
}

export function readStream<T>(source: Readable): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const writer = new WritableObjectStream<T>();
        writer.on('finish', () => {
            resolve(writer.data);
        });
        writer.on('error', (err) => {
            reject(err);
        });
        source.pipe(writer);
    });
}

class ReadableObjectStream<T> extends Readable {
    public iterator: Iterator<T>;

    constructor(objects: Iterable<T>) {
        super({ objectMode: true });
        this.iterator = objects[Symbol.iterator]();
    }

    override _read() {
        const next = this.iterator.next();
        this.push(next.done ? null : next.value);
    }
}

export function objectStream<T>(objects: Iterable<T>): ReadableObjectStream<T> {
    return new ReadableObjectStream(objects);
}