import type { Writable } from 'stream';
import type { Dimensions } from '@src/types';
import type { SourceEvent, WriteEvent } from '@src/source';
import callbackStream, { NodeRecordingStream } from '@src/node';
import { consume } from './helpers/streams';
import stub from './helpers/stub';

const dimensions: Dimensions = { columns: 80, rows: 5 };

let stdout: jest.SpyInstance<boolean, Parameters<typeof process.stdout.write>>,
    stderr: jest.SpyInstance<boolean, Parameters<typeof process.stderr.write>>;

beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('callbackStream', () => {
    test('capture writes to stdout & stderr inside `run` block', async () => {
        const stream = callbackStream((source) => {
            process.stdout.write('write to stdout', () => {});
            process.stderr.write(Buffer.from('write to stderr', 'utf-8'));
            source.finish();
        }, dimensions);
        await stream;
        expect(stream.ended).toBe(true);
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).not.toHaveBeenCalled();
        await expect(consume<SourceEvent>(stream)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { content: 'write to stdout' },
            { content: 'write to stderr' },
            { type: 'finish' },
        ]);
    });

    test('ensure `stdout` & `stderr` streams implement tty.WriteStream when `isTTY` is false', async () => {
        const restore = stub(process.stdout, { isTTY: false }),
            stream = callbackStream<[boolean, string[]]>(() => {
                process.stdout.cursorTo(0);
                process.stdout.clearLine(1);
                process.stdout.clearScreenDown();
                process.stdout.moveCursor(1, 2);
                return [process.stdout.isTTY, Object.getOwnPropertyNames(process.stdout)];
            }, dimensions);
        await expect(stream).resolves.toEqual([true, expect.arrayContaining([
            'isTTY',
            'cursorTo',
            'moveCursor',
            'clearLine',
            'clearScreenDown',
            'getWindowSize',
        ])]);
        // restore original isTTY value on `process.stdout`
        restore();
        // check source write events for correct output from tty write stream methods
        const writes = ((await consume<SourceEvent>(stream)).filter((e) => !('type' in e)) as WriteEvent[])
            .map(({ content }) => content);
        expect(writes).toEqual([
            '\x1b[1G', // cursorTo(0)
            '\x1b[0K', // clearLine(1)
            '\x1b[0J', // clearScreenDown()
            '\x1b[1C\x1b[2B', // moveCursor(1, 2)
        ]);
    });

    test('hook into stdout `columns` & `rows` to mimic provided terminal size', async () => {
        const stream = callbackStream<[number, number, [number, number]]>(() => [
            process.stdout.columns,
            process.stdout.rows,
            process.stdout.getWindowSize(),
        ], dimensions);
        await expect(stream).resolves.toEqual([80, 5, [80, 5]]);
    });

    test('hook into stdout `getColorDepth` & `hasColors` methods to mimic 24 bit color support', async () => {
        const stream = callbackStream<[number, boolean, boolean]>(() => [
            process.stdout.getColorDepth(),
            process.stdout.hasColors(),
            process.stdout.hasColors(256),
        ], dimensions);
        await expect(stream).resolves.toStrictEqual([24, true, true]);
    });

    test('pipes output to terminal if `silent` option is `false`', async () => {
        await callbackStream(() => {
            process.stdout.write('message');
        }, { ...dimensions, silent: false });
        expect(stdout.mock.calls.map(([a]) => a)).toEqual([
            NodeRecordingStream.kCaptureStartLine,
            'message',
            NodeRecordingStream.kCaptureEndLine,
        ]);
    });

    test('readline interface instances can be created via the `createInterface` method', async () => {
        const stream = callbackStream<string[]>((source) => {
            const rl = source.createInterface(),
                lines: string[] = [];
            rl.on('line', (line) => void lines.push(line));
            rl.write('written from a readline interface\n');
            return new Promise((resolve) => {
                rl.once('close', () => {
                    resolve(lines);
                });
                rl.close();
            });
        }, dimensions);
        await expect(stream).resolves.toEqual(['written from a readline interface']);
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).not.toHaveBeenCalled();
    });

    describe('errors', () => {
        test('catch errors that occur before stream is finished', async () => {
            const stream = callbackStream(() => {
                throw new Error('run error');
            }, dimensions);
            await expect(stream).resolves.toBeNull();
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
            await expect(consume<SourceEvent>(stream)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start' },
                { type: 'finish', error: { message: 'run error' } },
            ]);
        });

        test('errors passed directly to finish', async () => {
            const stream = callbackStream((source) => {
                const error = new Error('run error');
                source.finish(error);
            }, dimensions);
            await expect(stream).resolves.toBeUndefined();
            expect(stream.ended).toBe(true);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
            await expect(consume<SourceEvent>(stream)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start' },
                { type: 'finish', error: { message: 'run error' } },
            ]);
        });

        test('errors thrown after finish will cause stream to throw', async () => {
            const stream = callbackStream((source) => {
                source.finish();
                throw new Error('post finish error');
            }, dimensions);
            await expect(stream).rejects.toThrow('post finish error');
            expect(stream.ended).toBe(true);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });
    });

    describe('input', () => {
        test('emit artificial keypress events', async () => {
            const stream = callbackStream<string[]>(async (source) => {
                const rl = source.createInterface(),
                    lines: string[] = [];
                rl.on('line', (line) => void lines.push(line));
                // emit mock keypress events
                await source.emitKeypressSequence(['a', 'b']);
                await source.emitKeypressSequence('cd');
                source.input.write(Buffer.from('ef', 'utf-8'));
                await source.emitKeypress('\n');
                // close readline interface
                await new Promise((resolve) => {
                    rl.once('close', resolve);
                    rl.close();
                });
                return lines;
            }, dimensions);
            // test run block
            await expect(stream).resolves.toEqual(['abcdef']);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });

        test('pipe `process.stdin` to `input` stream if `connectStdin` option is true', async () => {
            const setRawMode = jest.fn((() => {}) as any as typeof process.stdin.setRawMode),
                restore = stub(process.stdin, { isTTY: true, isRaw: false, setRawMode }),
                stream = callbackStream<string>((source) => {
                    const rl = source.createInterface();
                    return new Promise((resolve) => {
                        rl.once('line', (line) => {
                            rl.once('close', () => {
                                resolve(line);
                            });
                            rl.close();
                        });
                        process.stdin.write('abc\n');
                    });
                }, { ...dimensions, connectStdin: true });
            await expect(stream).resolves.toBe('abc');
            restore();
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
            expect(setRawMode).toHaveBeenCalled();
        });
    });

    describe('resizing', () => {
        const resizePromise = (recording: NodeRecordingStream, stream: Writable) => (
            new Promise((resolve) => {
                const [onResize, onEnd] = [() => {
                    recording.removeListener('recording-end', onEnd);
                    resolve(true);
                }, () => {
                    stream.removeListener('resize', onResize);
                    resolve(false);
                }];
                stream.once('resize', onResize);
                recording.once('recording-end', onEnd);
            })
        );

        test('trigger artificial resize events on `stdout` & `stderr` output streams', async () => {
            const stream = callbackStream((source) => {
                source.resize(90, 10);
            }, dimensions);
            await expect(Promise.all([
                resizePromise(stream, process.stdout),
                stream,
            ])).resolves.toEqual([true]);
        });

        test('suppress artificial resize events when size does not change', async () => {
            const stream = callbackStream((source) => {
                source.resize(stream.columns, stream.rows);
            }, dimensions);
            await expect(Promise.all([
                resizePromise(stream, process.stdout),
                stream,
            ])).resolves.toEqual([false]);
        });
    });
});