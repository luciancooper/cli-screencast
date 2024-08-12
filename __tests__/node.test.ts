import { inspect } from 'util';
import type { Writable } from 'stream';
import type { Dimensions } from '@src/types';
import type { SourceEvent, WriteEvent } from '@src/source';
import readableCallback, { NodeRecordingStream } from '@src/node';
import { consumePromisified } from './helpers/streams';
import stub from './helpers/stub';

const dimensions: Dimensions = { columns: 80, rows: 5 };

let stdout: jest.SpyInstance<boolean, Parameters<typeof process.stdout.write>>,
    stderr: jest.SpyInstance<boolean, Parameters<typeof process.stderr.write>>,
    ac: AbortController;

beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    ac = new AbortController();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('readableCallback', () => {
    test('capture writes to stdout & stderr inside `run` block', async () => {
        const stream = readableCallback((source) => {
            process.stdout.write('write to stdout', () => {});
            process.stderr.write(Buffer.from('write to stderr', 'utf-8'));
            source.finish();
        }, dimensions, ac);
        // consume stream & check resulting events
        await expect(consumePromisified<SourceEvent>(stream)).resolves.toMatchObject<Partial<SourceEvent>[]>([
            { type: 'start' },
            { content: 'write to stdout' },
            { content: 'write to stderr' },
            { type: 'finish' },
        ]);
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).not.toHaveBeenCalled();
    });

    test('ensure `stdout` & `stderr` streams implement tty.WriteStream when `isTTY` is false', async () => {
        const restore = stub(process.stdout, { isTTY: false }),
            stream = readableCallback<[boolean, [number, number], string[]]>(() => {
                process.stdout.cursorTo(0);
                process.stdout.clearLine(1);
                process.stdout.clearScreenDown();
                process.stdout.moveCursor(1, 2);
                return [
                    process.stdout.isTTY,
                    process.stdout.getWindowSize(),
                    Object.getOwnPropertyNames(process.stdout),
                ];
            }, dimensions, ac),
            events = await consumePromisified<SourceEvent>(stream);
        // check callback result
        expect(stream.result).toEqual([true, [dimensions.columns, dimensions.rows], expect.arrayContaining([
            'isTTY',
            'cursorTo',
            'moveCursor',
            'clearLine',
            'clearScreenDown',
            'getWindowSize',
        ])]);
        // check source write events for correct output from tty write stream methods
        expect((events.filter((e) => !('type' in e)) as WriteEvent[]).map(({ content }) => content)).toEqual([
            '\x1b[1G', // cursorTo(0)
            '\x1b[0K', // clearLine(1)
            '\x1b[0J', // clearScreenDown()
            '\x1b[1C\x1b[2B', // moveCursor(1, 2)
        ]);
        // restore original isTTY value on `process.stdout`
        restore();
    });

    test('hook into stdout `columns` & `rows` to mimic provided terminal size', async () => {
        const stream = readableCallback<[number, number, [number, number]]>(() => [
            process.stdout.columns,
            process.stdout.rows,
            process.stdout.getWindowSize(),
        ], dimensions, ac);
        // ensure stream promise resolves
        await expect(stream).resolves.toBeUndefined();
        // check callback result
        expect(stream.result).toEqual([80, 5, [80, 5]]);
    });

    test('hook into stdout `getColorDepth` & `hasColors` methods to mimic 24 bit color support', async () => {
        const stream = readableCallback<[number, boolean, boolean]>(() => [
            process.stdout.getColorDepth(),
            process.stdout.hasColors(),
            process.stdout.hasColors(256),
        ], dimensions, ac);
        // ensure stream promise resolves
        await expect(stream).resolves.toBeUndefined();
        // check callback result
        expect(stream.result).toStrictEqual([24, true, true]);
    });

    test('pipes output to terminal if `silent` option is `false`', async () => {
        const stream = readableCallback(() => {
            process.stdout.write('message');
        }, { ...dimensions, silent: false }, ac);
        // ensure stream promise resolves
        await expect(stream).resolves.toBeUndefined();
        // check calls to stdout
        expect(stdout.mock.calls.map(([a]) => a)).toEqual([
            NodeRecordingStream.kCaptureStartLine,
            'message',
            NodeRecordingStream.kCaptureEndLine,
        ]);
    });

    test('readline interface instances can be created via the `createInterface` method', async () => {
        const stream = readableCallback<string[]>((source) => {
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
        }, dimensions, ac);
        // ensure stream promise resolves
        await expect(stream).resolves.toBeUndefined();
        // check callback result
        expect(stream.result).toEqual(['written from a readline interface']);
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).not.toHaveBeenCalled();
    });

    describe('errors', () => {
        test('catch errors that occur before stream is finished', async () => {
            const stream = readableCallback(() => {
                throw new Error('run error');
            }, dimensions, ac);
            // consume stream & check resulting events
            await expect(consumePromisified<SourceEvent>(stream)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start' },
                { type: 'finish', content: expect.stringMatching(/^Error: run error\n/) },
            ]);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });

        test('outputs caught errors to stderr if `silent` option is `false`', async () => {
            const error = new Error('run error'),
                stream = readableCallback(() => {
                    throw error;
                }, { ...dimensions, silent: false }, ac);
            // ensure stream promise resolves
            await expect(stream).resolves.toBeUndefined();
            // check calls to stdout & stderr
            expect(stdout.mock.calls.map(([a]) => a)).toEqual([
                NodeRecordingStream.kCaptureStartLine,
                NodeRecordingStream.kCaptureEndLine,
            ]);
            expect(stderr.mock.calls.map(([a]) => a)).toEqual([
                `${inspect(error, { colors: true })}\n`,
            ]);
        });

        test('errors passed directly to finish are captured', async () => {
            const stream = readableCallback((source) => {
                const error = new Error('run error');
                source.finish(error);
            }, dimensions, ac);
            // consume stream & check resulting events
            await expect(consumePromisified<SourceEvent>(stream)).resolves.toMatchObject<Partial<SourceEvent>[]>([
                { type: 'start' },
                { type: 'finish', content: expect.stringMatching(/^Error: run error\n/) },
            ]);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });

        test('errors passed to finish when stream is closed will destroy the stream', async () => {
            const stream = readableCallback((source) => {
                source.finish();
                source.finish(new Error('bad finish error'));
            }, dimensions, ac);
            // ensure stream promise rejects
            await expect(stream).rejects.toThrow('bad finish error');
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });

        test('errors thrown after finish will destroy the stream', async () => {
            const stream = readableCallback((source) => {
                source.finish();
                throw new Error('post finish error');
            }, dimensions, ac);
            // ensure stream promise rejects
            await expect(stream).rejects.toThrow('post finish error');
            expect(stream.destroyed).toBe(true);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });

        test('errors caught within callback destroy the stream', async () => {
            const stream = readableCallback((source) => {
                source.finish();
                try {
                    source.wait(1000);
                } catch {}
            }, dimensions, ac);
            // ensure stream promise rejects
            await expect(stream).rejects.toThrow("Cannot use 'wait' after source stream has been closed");
            expect(stream.destroyed).toBe(true);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });

        test('destroy is called within the callback', async () => {
            const stream = readableCallback((source) => {
                process.stdout.write('first write\n');
                source.destroy(new Error('direct destroy error'));
            }, dimensions, ac);
            // ensure stream promise rejects
            await expect(stream).rejects.toThrow('direct destroy error');
            // stdio streams need to be unhooked
            expect(stream.stdioHooked).toBe(false);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });
    });

    describe('input', () => {
        test('emit artificial keypress events', async () => {
            const stream = readableCallback<string[]>(async (source) => {
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
            }, dimensions, ac);
            // ensure stream promise resolves
            await expect(stream).resolves.toBeUndefined();
            // check callback result
            expect(stream.result).toEqual(['abcdef']);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });

        test('pipe `process.stdin` to `input` stream if `connectStdin` option is true', async () => {
            const setRawMode = jest.fn((() => {}) as any as typeof process.stdin.setRawMode),
                restore = stub(process.stdin, { isTTY: true, isRaw: false, setRawMode }),
                stream = readableCallback<string>((source) => {
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
                }, { ...dimensions, connectStdin: true }, ac);
            // ensure stream promise resolves
            await expect(stream).resolves.toBeUndefined();
            // check callback result
            expect(stream.result).toBe('abc');
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
            expect(setRawMode).toHaveBeenCalled();
            restore();
        });
    });

    describe('resizing', () => {
        const resizePromise = (recording: NodeRecordingStream<void>, stream: Writable) => (
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
            const stream = readableCallback((source) => {
                source.resize(90, 10);
            }, dimensions, ac);
            await expect(Promise.all([
                resizePromise(stream, process.stdout),
                stream,
            ])).resolves.toEqual([true]);
        });

        test('suppress artificial resize events when size does not change', async () => {
            const stream = readableCallback((source) => {
                source.resize(stream.columns, stream.rows);
            }, dimensions, ac);
            await expect(Promise.all([
                resizePromise(stream, process.stdout),
                stream,
            ])).resolves.toEqual([false]);
        });
    });
});