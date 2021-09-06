import { Writable, Readable } from 'stream';

export class WritableObjectStream<T> extends Writable {
    public data: T[] = [];

    constructor() {
        super({ objectMode: true });
    }

    override _write(chunk: T, enc: BufferEncoding, cb: (error?: Error | null) => void) {
        this.data.push(chunk);
        cb();
    }

    override _writev(chunks: { chunk: T }[], cb: (error?: Error | null) => void) {
        for (const { chunk } of chunks) this.data.push(chunk);
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