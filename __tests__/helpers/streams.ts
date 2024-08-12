import type { Readable } from 'stream';

export async function consume<T>(source: Readable): Promise<T[]> {
    const chunks: T[] = [];
    for await (const chunk of source) {
        chunks.push(chunk as T);
    }
    return chunks;
}

export async function consumePromisified<T>(source: Readable & PromiseLike<void>): Promise<T[]> {
    const chunks = await consume<T>(source);
    return source.then(() => chunks);
}