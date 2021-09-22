import type { Writable } from 'stream';

export interface StdoutCapture {
    readonly captured: string
    restore: () => void
}

export default function captureWrites(stream: Writable): StdoutCapture {
    let captured = '';
    // store original `write` property descriptor
    const descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'write')!;
    // replace `write` function
    stream.write = (chunk: any, ...args): boolean => {
        captured += Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : typeof chunk === 'string' ? chunk : '';
        return true;
    };
    // return stdout object
    return {
        get captured() {
            return captured;
        },
        restore() {
            Object.defineProperty(stream, 'write', descriptor);
        },
    };
}