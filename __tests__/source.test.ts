import RecordingStream, { type SourceEvent } from '@src/source';
import type { TerminalOptions } from '@src/types';
import { consume } from './helpers/streams';

const defOptions: TerminalOptions = {
    columns: 20,
    rows: 10,
};

afterEach(() => {
    jest.restoreAllMocks();
});

describe('RecordingStream', () => {
    describe('write', () => {
        test('emits write events', async () => {
            const source = new RecordingStream(defOptions);
            source.start();
            source.write('string write');
            source.write(Buffer.from('buffer write', 'utf-8'));
            source.write('');
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'string write' },
                { content: 'buffer write' },
                { type: 'finish' },
            ]);
        });

        test('activates stream when called before start', async () => {
            const source = new RecordingStream(defOptions);
            source.write('pre-start write');
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'pre-start write' },
                { type: 'finish' },
            ]);
        });

        test('writing to stream after it has closed throws an error', async () => {
            const source = new RecordingStream(defOptions);
            source.finish();
            await expect(new Promise<void>((resolve, reject) => {
                source.once('error', reject);
                source.write('illegal write');
            })).rejects.toMatchObject({ message: 'Source stream is closed' });
        });
    });

    describe('start', () => {
        test('extra calls are ignored', async () => {
            const source = new RecordingStream(defOptions);
            source.start();
            source.start();
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { type: 'finish' },
            ]);
        });

        test('throws error if called after stream has closed', async () => {
            const source = new RecordingStream(defOptions);
            source.finish();
            // bad start() call
            expect(() => {
                source.start();
            }).toThrow('Source stream is closed');
        });
    });

    describe('finish', () => {
        test('is called by `_final` if stream is closed via `end()`', async () => {
            const source = new RecordingStream(defOptions);
            source.write('first write');
            source.end('end write');
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'first write' },
                { content: 'end write' },
                { type: 'finish' },
            ]);
        });

        test('throws error if called after stream has closed', async () => {
            const source = new RecordingStream(defOptions);
            source.finish();
            expect(() => {
                source.finish();
            }).toThrow('Source stream is closed');
        });
    });

    describe('queueFinish', () => {
        test('writes are ignored after finish is queued', async () => {
            const spy = jest.spyOn(Date, 'now');
            spy.mockImplementationOnce(() => 5);
            spy.mockImplementationOnce(() => 5);
            const source = new RecordingStream(defOptions);
            source.write('first write');
            spy.mockImplementationOnce(() => 10);
            source.queueFinish();
            source.write('ignored write');
            source.end('ignored end write');
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'first write', time: 0 },
                { type: 'finish', time: 5 },
            ]);
        });

        test('extra calls are ignored', async () => {
            const spy = jest.spyOn(Date, 'now');
            spy.mockImplementationOnce(() => 5);
            const source = new RecordingStream(defOptions);
            source.start();
            spy.mockImplementationOnce(() => 10);
            source.queueFinish();
            spy.mockImplementationOnce(() => 15);
            source.queueFinish();
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { type: 'finish', time: 5 },
            ]);
        });

        test('activates stream when called before start', async () => {
            const spy = jest.spyOn(Date, 'now');
            spy.mockImplementationOnce(() => 5);
            spy.mockImplementationOnce(() => 5);
            const source = new RecordingStream(defOptions);
            source.queueFinish();
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { type: 'finish', time: 0 },
            ]);
        });

        test('throws error if called after stream has closed', () => {
            const source = new RecordingStream(defOptions);
            source.finish();
            expect(() => {
                source.queueFinish();
            }).toThrow('Source stream is closed');
        });
    });

    describe('wait', () => {
        test('increments the time adjustment of the next emitted event', async () => {
            const source = new RecordingStream(defOptions);
            source.start();
            source.write('write 1');
            source.wait(500);
            source.write('write 2');
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: 'write 1', adjustment: 0 },
                { content: 'write 2', adjustment: 500 },
                { type: 'finish', adjustment: 0 },
            ]);
        });

        test('activates stream when called before start', async () => {
            const source = new RecordingStream(defOptions);
            source.wait(500);
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { type: 'finish', adjustment: 500 },
            ]);
        });

        test('ignored if finish has been queued', async () => {
            const source = new RecordingStream(defOptions);
            source.start();
            source.queueFinish();
            source.wait(500);
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { type: 'finish', adjustment: 0 },
            ]);
        });

        test('throws error if called after stream has closed', () => {
            const source = new RecordingStream(defOptions);
            source.finish();
            expect(() => {
                source.wait(500);
            }).toThrow('Source stream is closed');
        });
    });

    describe('setTitle', () => {
        test('creates window title escape sequence write events', async () => {
            const source = new RecordingStream(defOptions);
            source.start();
            source.setTitle('window title', 'node');
            source.setTitle('node task', true);
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: '\x1b]2;window title\x07\x1b]1;node\x07' },
                { content: '\x1b]0;node task\x07' },
                { type: 'finish' },
            ]);
        });

        test('activates stream when called before start', async () => {
            const source = new RecordingStream(defOptions);
            source.setTitle('window title');
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { content: '\x1b]2;window title\x07' },
                { type: 'finish' },
            ]);
        });

        test('ignored if finish has been queued', async () => {
            const source = new RecordingStream(defOptions);
            source.start();
            source.queueFinish();
            source.setTitle('ignored window title');
            source.finish();
            await expect(consume<SourceEvent>(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start', ...source.termOptions },
                { type: 'finish' },
            ]);
        });

        test('throws error if called after stream has closed', () => {
            const source = new RecordingStream(defOptions);
            source.finish();
            expect(() => {
                source.setTitle('title');
            }).toThrow('Source stream is closed');
        });
    });

    describe('fromFrames', () => {
        test('creates a source stream from a sequence of frame objects', async () => {
            const source = RecordingStream.fromFrames(defOptions, [
                { content: 'line 1', duration: 500 },
                { content: 'line 2', duration: 500 },
                { content: 'line 3', duration: 500 },
            ]);
            await expect(consume<SourceEvent>(source)).resolves.toEqual<SourceEvent[]>([
                { type: 'start', ...source.termOptions },
                { content: 'line 1', time: 0 },
                { content: 'line 2', time: 500 },
                { content: 'line 3', time: 1000 },
                { type: 'finish', time: 1500 },
            ]);
        });
    });
});