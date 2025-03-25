import RecordingStream, { readableFrames, type SourceEvent } from '@src/source';
import type { TerminalOptions } from '@src/types';
import { promisifyStream } from '@src/utils';
import { consume, consumePromisified } from './helpers/streams';

const defOptions: TerminalOptions = {
    columns: 20,
    rows: 10,
};

function mockDateNow(times: number[]) {
    const { now } = Date;
    let i = 0;
    const spy = jest.spyOn(Date, 'now');
    spy.mockImplementation(() => (
        // eslint-disable-next-line no-plusplus
        times[i++] ?? now()
    ));
    return spy;
}

afterEach(() => {
    jest.restoreAllMocks();
});

describe('RecordingStream', () => {
    describe('write', () => {
        test('emits write events', async () => {
            mockDateNow([5, 5, 10, 15]);
            const source = new RecordingStream(defOptions);
            source.start(); // now: 5
            source.write('string write'); // now: 5
            source.write(Buffer.from('buffer write', 'utf-8')); // now: 10
            source.write('');
            source.finish(); // now: 15
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'string write', time: 0 },
                { content: 'buffer write', time: 5 },
                { type: 'finish', time: 10 },
            ]);
        });

        test('activates stream when called before start', async () => {
            mockDateNow([5, 8, 10]);
            const source = new RecordingStream(defOptions);
            source.write('pre-start write'); // now: 5 & 8
            source.finish(); // now: 10
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'pre-start write', time: 3 },
                { type: 'finish', time: 5 },
            ]);
        });

        test('writing to stream after it has closed throws an error', async () => {
            const source = new RecordingStream(defOptions),
                promise = promisifyStream(source, new AbortController());
            source.finish();
            source.write('illegal write');
            // stream should be destroyed by the invalid write
            await expect(promise).rejects.toThrow('Invalid write, source stream has been closed');
        });
    });

    describe('start', () => {
        test('command argument is passed to start event', async () => {
            mockDateNow([10, 20]);
            const source = new RecordingStream(defOptions);
            source.start('ls'); // now: 10
            source.finish(); // now: 20
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', command: 'ls', ...source.termOptions },
                { type: 'finish', time: 10 },
            ]);
        });

        test('extra calls are ignored', async () => {
            mockDateNow([5, 10]);
            const source = new RecordingStream(defOptions);
            source.start(); // now: 5
            source.start();
            source.finish(); // now: 10
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { type: 'finish', time: 5 },
            ]);
        });

        test('throws error if called after stream has closed', async () => {
            const source = new RecordingStream(defOptions),
                promise = promisifyStream(source, new AbortController());
            source.finish();
            // a bad start() call should throw
            expect(() => {
                source.start();
            }).toThrow("Cannot use 'start' after source stream has been closed");
            // stream should be destroyed by the bad start() call
            await expect(promise).rejects.toThrow("Cannot use 'start' after source stream has been closed");
        });
    });

    describe('finish', () => {
        test('is called by `_final` if stream is closed via `end()`', async () => {
            mockDateNow([5, 5, 12, 13]);
            const source = new RecordingStream(defOptions);
            source.write('first write'); // now: 5 & 5
            source.end('end write'); // now: 12 & 13
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'first write', time: 0 },
                { content: 'end write', time: 7 },
                { type: 'finish', time: 8 },
            ]);
        });

        test('throws error if called after stream has closed', async () => {
            const source = new RecordingStream(defOptions),
                promise = promisifyStream(source, new AbortController());
            source.finish();
            // a bad finish() call should throw
            expect(() => {
                source.finish();
            }).toThrow("Cannot use 'finish' after source stream has been closed");
            // stream should be destroyed by the bad finish() call
            await expect(promise).rejects.toThrow("Cannot use 'finish' after source stream has been closed");
        });
    });

    describe('wait', () => {
        test('increments the time adjustment of the next emitted event', async () => {
            mockDateNow([5, 10, 12, 15]);
            const source = new RecordingStream(defOptions);
            source.start(); // now: 5
            source.write('write 1'); // now: 10
            source.wait(500);
            source.write('write 2'); // now: 12
            source.finish(); // now: 15
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'write 1', time: 5, adjustment: 0 },
                { content: 'write 2', time: 7, adjustment: 500 },
                { type: 'finish', time: 10, adjustment: 0 },
            ]);
        });

        test('activates stream when called before start', async () => {
            mockDateNow([5, 10]);
            const source = new RecordingStream(defOptions);
            source.wait(500); // now: 5
            source.finish(); // now: 10
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { type: 'finish', time: 5, adjustment: 500 },
            ]);
        });

        test('throws error if called after stream has closed', async () => {
            const source = new RecordingStream(defOptions),
                promise = promisifyStream(source, new AbortController());
            source.finish();
            // a bad wait() call should throw
            expect(() => {
                source.wait(500);
            }).toThrow("Cannot use 'wait' after source stream has been closed");
            // stream should be destroyed by the bad wait() call
            await expect(promise).rejects.toThrow("Cannot use 'wait' after source stream has been closed");
        });
    });

    describe('setTitle', () => {
        test('creates window title / icon osc sequence write events', async () => {
            mockDateNow([5, 10, 15, 20, 25]);
            const source = new RecordingStream(defOptions);
            source.start(); // now: 5
            source.setTitle('window title'); // 10
            source.setTitle({ title: 'node task', icon: 'node' }); // 15
            source.setTitle({ title: '', icon: '' }); // 20
            source.setTitle({}); // empty object no write
            // @ts-expect-error passing no argument violates type signature
            source.setTitle(); // no argument
            source.finish(); // 25
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: '\x1b]2;window title\x07', time: 5 },
                { content: '\x1b]2;node task\x07\x1b]1;node\x07', time: 10 },
                { content: '\x1b]2;\x07\x1b]1;\x07', time: 15 },
                { type: 'finish', time: 20 },
            ]);
        });

        test('activates stream when called before start', async () => {
            mockDateNow([5, 6, 10]);
            const source = new RecordingStream(defOptions);
            source.setTitle('window title'); // now: 5 & 6
            source.finish(); // now:  10
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: '\x1b]2;window title\x07', time: 1 },
                { type: 'finish', time: 5 },
            ]);
        });

        test('throws error if called after stream has closed', async () => {
            const source = new RecordingStream(defOptions),
                promise = promisifyStream(source, new AbortController());
            source.finish();
            // a bad setTitle() call should throw
            expect(() => {
                source.setTitle('title');
            }).toThrow("Cannot use 'setTitle' after source stream has been closed");
            // stream should be destroyed by the bad setTitle() call
            await expect(promise).rejects.toThrow("Cannot use 'setTitle' after source stream has been closed");
        });
    });
});

describe('readableFrames', () => {
    test('creates a source stream from an array of frames', async () => {
        const source = readableFrames(defOptions, [
            { content: 'line 1', duration: 500 },
            { content: 'line 2', duration: 500 },
            { content: 'line 3', duration: 500 },
        ], new AbortController());
        await expect(consumePromisified<SourceEvent>(source)).resolves.toEqual<SourceEvent[]>([
            expect.objectContaining({ type: 'start' }),
            { content: 'line 1', time: 0 },
            { content: 'line 2', time: 500 },
            { content: 'line 3', time: 1000 },
            { type: 'finish', time: 1500 },
        ]);
    });

    test('command option is passed to start event', async () => {
        const source = readableFrames({ ...defOptions, command: 'ls' }, [
            { content: ['file1.txt', 'file2.txt'].join('\n'), duration: 500 },
        ], new AbortController());
        await expect(consumePromisified<SourceEvent>(source)).resolves.toEqual<SourceEvent[]>([
            expect.objectContaining({ type: 'start', command: 'ls' }),
            { content: ['file1.txt', 'file2.txt'].join('\n'), time: 0 },
            { type: 'finish', time: 500 },
        ]);
    });

    test('can handle an empty array of frames', async () => {
        const source = readableFrames(defOptions, [], new AbortController());
        await expect(consumePromisified<SourceEvent>(source)).resolves.toEqual<SourceEvent[]>([
            expect.objectContaining({ type: 'start' }),
            { type: 'finish', time: 0 },
        ]);
    });
});