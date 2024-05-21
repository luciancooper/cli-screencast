import type { Writable } from 'stream';
import type { SourceEvent, WriteEvent } from '@src/source';
import NodeRecordingStream from '@src/node';
import { applyDefaults } from '@src/options';
import { consume } from './helpers/streams';
import stub from './helpers/stub';

const options = applyDefaults({
    columns: 80,
    rows: 5,
    tabSize: 8,
});

let stdout: jest.SpyInstance<boolean, Parameters<typeof process.stdout.write>>,
    stderr: jest.SpyInstance<boolean, Parameters<typeof process.stderr.write>>;

beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('NodeRecordingStream', () => {
    test('capture writes to stdout & stderr inside `run` block', async () => {
        const stream = new NodeRecordingStream(options);
        await stream.run((source) => {
            process.stdout.write('write to stdout', () => {});
            process.stderr.write(Buffer.from('write to stderr', 'utf-8'));
            source.finish();
        });
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
            stream = new NodeRecordingStream(options);
        await expect(stream.run(() => {
            process.stdout.cursorTo(0);
            process.stdout.clearLine(1);
            process.stdout.clearScreenDown();
            process.stdout.moveCursor(1, 2);
            return [process.stdout.isTTY, Object.getOwnPropertyNames(process.stdout)];
        })).resolves.toEqual([true, expect.arrayContaining([
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
        await expect(new NodeRecordingStream(options).run(() => [
            process.stdout.columns,
            process.stdout.rows,
            process.stdout.getWindowSize(),
        ])).resolves.toEqual([80, 5, [80, 5]]);
    });

    test('hook into stdout `getColorDepth` & `hasColors` methods to mimic 24 bit color support', async () => {
        await expect(new NodeRecordingStream(options).run(() => [
            process.stdout.getColorDepth(),
            process.stdout.hasColors(),
            process.stdout.hasColors(256),
        ])).resolves.toStrictEqual([24, true, true]);
    });

    test('pipes output to terminal if `silent` option is `false`', async () => {
        await new NodeRecordingStream({ ...options, silent: false }).run(() => {
            process.stdout.write('message');
        });
        expect(stdout.mock.calls.map(([a]) => a)).toEqual([
            NodeRecordingStream.kCaptureStartLine,
            'message',
            NodeRecordingStream.kCaptureEndLine,
        ]);
    });

    test('readline interface instances can be created via the `createInterface` method', async () => {
        await expect(new NodeRecordingStream(options).run<string[]>((source) => {
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
        })).resolves.toEqual(['written from a readline interface']);
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).not.toHaveBeenCalled();
    });

    describe('errors', () => {
        test('catch errors that occur in the function passed to `run`', async () => {
            const stream = new NodeRecordingStream(options);
            await expect(stream.run(() => {
                throw new Error('run error');
            })).rejects.toMatchObject({ message: 'run error' });
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
            const events = await consume<SourceEvent>(stream);
            expect(events[events.length - 1]).toMatchObject<Partial<SourceEvent>>({
                type: 'finish',
                error: { message: 'run error' },
            });
        });

        test('pass an error to `finish` inside `run` block', async () => {
            const stream = new NodeRecordingStream(options);
            await expect(stream.run((source) => {
                const error = new Error('run error');
                source.finish(error);
                throw error;
            })).rejects.toMatchObject({ message: 'run error' });
            expect(stream.ended).toBe(true);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });
    });

    describe('input', () => {
        test('emit artificial keypress events', async () => {
            const stream = new NodeRecordingStream(options);
            // test run block
            await expect(stream.run<string[]>(async (source) => {
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
            })).resolves.toEqual(['abcdef']);
            expect(stdout).not.toHaveBeenCalled();
            expect(stderr).not.toHaveBeenCalled();
        });

        test('pipe `process.stdin` to `input` stream if `connectStdin` option is true', async () => {
            const setRawMode = jest.fn((() => {}) as any as typeof process.stdin.setRawMode),
                restore = stub(process.stdin, { isTTY: true, isRaw: false, setRawMode });
            await expect(new NodeRecordingStream({ ...options, connectStdin: true }).run<string>((source) => {
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
            })).resolves.toBe('abc');
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
            const stream = new NodeRecordingStream(options),
                [resizeEmitted] = await Promise.all([
                    resizePromise(stream, process.stdout),
                    stream.run(async (source) => {
                        source.resize(90, 10);
                    }),
                ]);
            expect(resizeEmitted).toBe(true);
        });

        test('suppress artificial resize events when size does not change', async () => {
            const stream = new NodeRecordingStream(options),
                [resizeEmitted] = await Promise.all([
                    resizePromise(stream, process.stdout),
                    stream.run((source) => {
                        source.resize(options.columns, options.rows);
                    }),
                ]);
            expect(resizeEmitted).toBe(false);
        });
    });
});