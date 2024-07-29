import type { Readable } from 'stream';

export async function consume<T>(source: Readable): Promise<T[]> {
    const chunks: T[] = [];
    for await (const chunk of source) {
        chunks.push(chunk as T);
    }
    return chunks;
}

export async function consumePromise<P, T>(source: Readable & PromiseLike<P>): Promise<[resolved: P, consumed: T[]]> {
    const chunks: T[] = [];
    for await (const chunk of source) {
        chunks.push(chunk as T);
    }
    return [await source, chunks];
}