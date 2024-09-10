import type { PartialExcept, DeepPartial, CaptureData, TerminalOptions, Dimensions } from '@src/types';
import RecordingStream, { readableEvents, type SourceEvent, type StartEvent } from '@src/source';
import captureSource, { type CaptureOptions } from '@src/capture';
import { applyDefTerminalOptions } from '@src/options';
import { promisifyStream, mergePromise } from '@src/utils';
import * as ansi from './helpers/ansi';

const defDimensions: Dimensions = { columns: 50, rows: 10 };

function runCapture(
    partialEvents: (PartialExcept<StartEvent, 'type'> | Exclude<SourceEvent, StartEvent>)[],
    captureOptions: CaptureOptions = {},
    termOptions: Partial<TerminalOptions> = {},
) {
    const termProps = applyDefTerminalOptions({ ...defDimensions, ...termOptions }),
        events = partialEvents.map<SourceEvent>((evt) => (evt.type === 'start' ? { ...termProps, ...evt } : evt)),
        ac = new AbortController(),
        source = readableEvents(events, ac);
    return captureSource(source, captureOptions, ac);
}

type PartialCaptureData = DeepPartial<CaptureData>;

describe('captureSource', () => {
    test('processes source events from a readable stream', async () => {
        await expect(runCapture([
            { type: 'start' },
            { content: 'first write', time: 0 },
            { content: 'second write', time: 500 },
            { type: 'finish', time: 600 },
        ], { endTimePadding: 400 })).resolves.toMatchObject<PartialCaptureData>({
            writes: [
                { content: 'first write', delay: 0 },
                { content: 'second write', delay: 500 },
            ],
            endDelay: 500,
        });
    });

    describe('initial window title and icon conditions', () => {
        test('window title only', async () => {
            await expect(runCapture(
                [{ type: 'start' }, { content: 'first write', time: 500 }, { type: 'finish', time: 500 }],
                { cropStartDelay: false },
                { windowTitle: 'Title' },
            )).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: '\x1b]2;Title\x07', delay: 0 }, { content: 'first write', delay: 500 }],
            });
        });

        test('window title + icon (string)', async () => {
            await expect(runCapture(
                [{ type: 'start' }, { content: 'first write', time: 500 }, { type: 'finish', time: 500 }],
                { cropStartDelay: false },
                { windowTitle: 'Title', windowIcon: 'node' },
            )).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: '\x1b]2;Title\x07\x1b]1;node\x07', delay: 0 },
                    { content: 'first write', delay: 500 },
                ],
            });
        });

        test('window title + icon (boolean)', async () => {
            await expect(runCapture(
                [{ type: 'start' }, { content: 'first write', time: 500 }, { type: 'finish', time: 500 }],
                { cropStartDelay: false },
                { windowTitle: 'Title', windowIcon: true },
            )).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: '\x1b]0;Title\x07', delay: 0 }, { content: 'first write', delay: 500 }],
            });
        });

        test('window icon only (string)', async () => {
            await expect(runCapture(
                [{ type: 'start' }, { content: 'first write', time: 500 }, { type: 'finish', time: 500 }],
                { cropStartDelay: false },
                { windowIcon: 'node' },
            )).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: '\x1b]1;node\x07', delay: 0 }, { content: 'first write', delay: 500 }],
            });
        });

        test('window icon only (boolean)', async () => {
            await expect(runCapture(
                [{ type: 'start' }, { content: 'first write', time: 500 }, { type: 'finish', time: 500 }],
                { cropStartDelay: false },
                { windowIcon: true },
            )).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: '\x1b]1;_\x07', delay: 0 }, { content: 'first write', delay: 500 }],
            });
        });
    });

    describe('merging consecutive writes', () => {
        test('consecutive writes with time differences less than `writeMergeThreshold` are merged', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write', time: 0 },
                // next two writes are merged
                { content: ansi.cursorColumn(0), time: 500 },
                { content: 'second write', time: 505 },
                { type: 'finish', time: 600 },
            ], { endTimePadding: 400 })).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: 'first write', delay: 0 },
                    { content: `${ansi.cursorColumn(0)}second write`, delay: 500 },
                ],
                endDelay: 500,
            });
        });

        test('time adjustments prevent consecutive writes from being merged', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write\n', time: 0 },
                { content: 'second write\n', time: 5, adjustment: 500 },
                { type: 'finish', time: 100 },
            ], { endTimePadding: 400 })).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: 'first write\n', delay: 0 },
                    { content: 'second write\n', delay: 505 },
                ],
                endDelay: 495,
            });
        });
    });

    describe('empty writes', () => {
        test('does not capture empty writes', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write', time: 0 },
                // empty write
                { content: '', time: 500 },
                { content: 'second write', time: 1000 },
                // empty write with time adjustment
                { content: '', time: 1000, adjustment: 500 },
                { content: '', time: 1500 },
                { content: 'third write', time: 2000, adjustment: 500 },
                { type: 'finish', time: 2000 },
            ])).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: 'first write', delay: 0 },
                    { content: 'second write', delay: 1000 },
                    { content: 'third write', delay: 2000 },
                ],
                endDelay: 500,
            });
        });

        test('empty ending writes are reflected in endDelay', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write', time: 0 },
                { content: 'second write', time: 500 },
                { content: '', time: 1000 },
                { type: 'finish', time: 1200 },
            ], { endTimePadding: 0 })).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: 'first write', delay: 0 },
                    { content: 'second write', delay: 500 },
                ],
                endDelay: 700,
            });
        });
    });

    describe('start delay', () => {
        test('delayed first write when `cropStartDelay` is disabled', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write', time: 500 },
                { type: 'finish', time: 1000 },
            ], {
                cropStartDelay: false,
                endTimePadding: 0,
            })).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: 'first write', delay: 500 }],
                endDelay: 500,
            });
        });

        test('delayed first write when `cropStartDelay` is enabled', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write', time: 500 },
                { type: 'finish', time: 1000 },
            ], {
                cropStartDelay: true,
                endTimePadding: 0,
            })).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: 'first write', delay: 0 }],
                endDelay: 500,
            });
        });

        test('start delay cropping does not apply to time adjustments on the first write', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write', time: 500, adjustment: 500 },
                { type: 'finish', time: 1000 },
            ], {
                cropStartDelay: true,
                endTimePadding: 0,
            })).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: 'first write', delay: 500 }],
                endDelay: 500,
            });
        });
    });

    describe('capture commands', () => {
        test('capture command prompt string with keystroke animation', async () => {
            await expect(runCapture([
                { type: 'start', command: 'ls' },
                { content: 'first write', time: 500 },
                { type: 'finish', time: 1000 },
            ], {
                captureCommand: true,
                prompt: '> ',
                keystrokeAnimation: true,
                keystrokeAnimationInterval: 100,
                endTimePadding: 500,
            }, { cursorHidden: true })).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: '> ', delay: 0 },
                    { content: 'l', delay: 200 },
                    { content: 's', delay: 100 },
                    { content: '\n\x1b[?25l', delay: 200 },
                    { content: 'first write', delay: 100 },
                ],
                endDelay: 1000,
            });
        });

        test('capture command prompt string without keystroke animation', async () => {
            await expect(runCapture([
                { type: 'start', command: 'ls' },
                { content: 'first write', time: 500 },
                { type: 'finish', time: 500 },
            ], {
                captureCommand: true,
                prompt: '> ',
                keystrokeAnimation: false,
                cropStartDelay: true,
                endTimePadding: 500,
            })).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: '> ls\nfirst write', delay: 0 }],
                endDelay: 500,
            });
        });
    });

    describe('finish events with content', () => {
        test('captures finish content as final write', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write\n', time: 500 },
                { type: 'finish', time: 1050, content: 'final content\n' },
            ], { cropStartDelay: false })).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: 'first write\n', delay: 500 },
                    { content: 'final content\n', delay: 550 },
                ],
                endDelay: 500,
            });
        });

        test('final write will merge with prior one within the merge threshold', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'previous write - ', time: 500 },
                { type: 'finish', time: 505, content: 'final content\n' },
            ], { cropStartDelay: false })).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: 'previous write - final content\n', delay: 500 },
                ],
                endDelay: 505,
            });
        });
    });

    describe('source streams with no write events', () => {
        test('source emits a start event followed immediately by a finish event', async () => {
            await expect(runCapture(
                [{ type: 'start' }, { type: 'finish', time: 0 }],
                { endTimePadding: 0 },
                { cursorHidden: true },
            )).resolves.toMatchObject<PartialCaptureData>({
                writes: [{ content: '\x1b[?25l', delay: 0 }],
                endDelay: 0,
            });
        });

        test('delayed finish immediately following start when `cropStartDelay` is enabled', async () => {
            await expect(runCapture(
                [{ type: 'start' }, { type: 'finish', time: 500 }],
                { cropStartDelay: true, endTimePadding: 0 },
            )).resolves.toMatchObject<PartialCaptureData>({
                writes: [],
                endDelay: 0,
            });
        });

        test('delayed finish immediately following start when `cropStartDelay` is disabled', async () => {
            await expect(runCapture(
                [{ type: 'start' }, { type: 'finish', time: 500 }],
                { cropStartDelay: false, endTimePadding: 0 },
            )).resolves.toMatchObject<PartialCaptureData>({
                writes: [],
                endDelay: 500,
            });
        });

        test('finish event immediately follows start event from which command is captured', async () => {
            await expect(runCapture([
                { type: 'start', command: 'ls' },
                { type: 'finish', time: 0 },
            ], {
                captureCommand: true,
                prompt: '> ',
                keystrokeAnimation: true,
                keystrokeAnimationInterval: 100,
                endTimePadding: 500,
            })).resolves.toMatchObject<PartialCaptureData>({
                writes: [
                    { content: '> ', delay: 0 },
                    { content: 'l', delay: 200 },
                    { content: 's', delay: 100 },
                    { content: '\n', delay: 200 },
                ],
                endDelay: 600,
            });
        });
    });

    describe('irregular source event errors', () => {
        test('source emits finish event before start', async () => {
            await expect(runCapture([
                { type: 'finish', time: 0 },
            ])).rejects.toThrow('Capture has not started');
        });

        test('source emits write event before start', async () => {
            await expect(runCapture([
                { content: 'first write', time: 0 },
            ])).rejects.toThrow('Capture has not started');
        });

        test('source emits multiple start events', async () => {
            await expect(runCapture([
                { type: 'start' },
                { type: 'start' },
            ])).rejects.toThrow('Capture has already started');
        });

        test('source emits multiple finish events', async () => {
            await expect(runCapture([
                { type: 'start' },
                { type: 'finish', time: 10 },
                { type: 'finish', time: 20 },
            ])).rejects.toThrow('Capture already finished');
        });

        test('source emits events after finish', async () => {
            await expect(runCapture([
                { type: 'start' },
                { type: 'finish', time: 10 },
                { content: 'first write', time: 20 },
            ])).rejects.toThrow('Capture already finished');
        });

        test('source does not emit finish event', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write', time: 10 },
            ])).rejects.toThrow('Incomplete capture - source did not finish');
        });
    });

    describe('errors in source streams', () => {
        const makeSource = (ac: AbortController) => {
            const stream = new RecordingStream(defDimensions);
            return mergePromise(stream, promisifyStream(stream, ac));
        };

        test('source stream emits error', async () => {
            const ac = new AbortController(),
                source = makeSource(ac),
                promise = captureSource(source, {}, ac);
            source.finish();
            source.write('bad write');
            await expect(promise).rejects.toThrow('Invalid write, source stream has been closed');
        });

        test('abort controller cancels streams', async () => {
            const ac = new AbortController(),
                source = makeSource(ac),
                promise = captureSource(source, {}, ac);
            source.write('first write');
            ac.abort();
            await expect(promise).rejects.toThrow('Incomplete capture - source did not finish');
        });
    });
});