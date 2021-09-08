import RecordingStream, { SourceEvent } from '@src/source';
import { readStream } from './helpers/streams';

describe('RecordingStream', () => {
    test('emits source events', async () => {
        const source = new RecordingStream();
        source.start();
        source.write('string write');
        source.write(Buffer.from('buffer write', 'utf-8'));
        source.write('');
        source.finish();
        await expect(readStream(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { type: 'write', content: 'string write' },
            { type: 'write', content: 'buffer write' },
            { type: 'finish' },
        ]);
    });

    test('write method will activate stream if called before start', async () => {
        const source = new RecordingStream();
        source.write('pre-start write');
        source.finish();
        await expect(readStream(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { type: 'write', content: 'pre-start write' },
            { type: 'finish' },
        ]);
    });

    test('wait method will activate stream if called before start', async () => {
        const source = new RecordingStream();
        source.wait(500);
        source.finish();
        await expect(readStream(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { type: 'wait', milliseconds: 500 },
            { type: 'finish' },
        ]);
    });

    test('extra start() calls are ignored', async () => {
        const source = new RecordingStream();
        source.start();
        source.start();
        source.finish();
        await expect(readStream(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { type: 'finish' },
        ]);
    });

    test('stream can be finished by calling `end()` with a final write', async () => {
        const source = new RecordingStream();
        source.write('first write');
        source.end('end write');
        await expect(readStream(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { type: 'write', content: 'first write' },
            { type: 'write', content: 'end write' },
            { type: 'finish' },
        ]);
    });

    test('throws error if methods are called after stream has closed', async () => {
        const source = new RecordingStream();
        source.finish();
        // bad start() call
        expect(() => void source.start()).toThrow('Source stream is closed');
        // bad wait() call
        expect(() => void source.wait(500)).toThrow('Source stream is closed');
        // bad write() call
        await expect(new Promise<void>((resolve, reject) => {
            source.once('error', reject);
            source.write('illegal write');
        })).rejects.toMatchObject({ message: 'Source stream is closed' });
        // bad finish() call
        expect(() => void source.finish()).toThrow('Source stream is closed');
    });
});