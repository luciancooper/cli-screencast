import RecordingSource, { SourceEvent } from '@src/source';
import { readStream } from './helpers/streams';

describe('RecordingSource', () => {
    test('emits source events', async () => {
        const source = new RecordingSource();
        source.start();
        source.write('string write');
        source.write(Buffer.from('buffer write', 'utf-8'));
        source.write(undefined);
        source.finish();
        await expect(readStream(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { type: 'write', content: 'string write' },
            { type: 'write', content: 'buffer write' },
            { type: 'finish' },
        ]);
    });

    test('write method will activate stream if called before start', async () => {
        const source = new RecordingSource();
        source.write('pre-start write');
        source.finish();
        await expect(readStream(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { type: 'write', content: 'pre-start write' },
            { type: 'finish' },
        ]);
    });

    test('extra start() calls are ignored', async () => {
        const source = new RecordingSource();
        source.start();
        source.start();
        source.finish();
        await expect(readStream(source)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { type: 'finish' },
        ]);
    });

    test('throws error if methods are called after stream has closed', () => {
        const source = new RecordingSource();
        source.finish();
        expect(() => void source.start()).toThrow('Source stream is closed');
        expect(() => void source.write('illegal write')).toThrow('Source stream is closed');
        expect(() => void source.finish()).toThrow('Source stream is closed');
    });
});