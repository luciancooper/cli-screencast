import type { DeepPartial, Dimensions, CaptureData, ContentKeyFrame, TitleKeyFrame } from '@src/types';
import { resolveTheme } from '@src/theme';
import { applyDefaults, Options } from '@src/options';
import type { SourceEvent } from '@src/source';
import { resolveTitle } from '@src/title';
import captureSource from '@src/capture';
import { makeLine, makeCursor } from './helpers/objects';
import { objectStream } from './helpers/streams';
import * as ansi from './helpers/ansi';

const { palette } = resolveTheme();

const defaultDimensions: Dimensions = {
    columns: 50,
    rows: 10,
};

function runCapture(events: SourceEvent[], options?: Options) {
    const readable = objectStream<SourceEvent>(events),
        props = applyDefaults({ ...defaultDimensions, ...options ?? {} });
    return captureSource(readable, props);
}

type PartialCaptureData = DeepPartial<CaptureData>;

describe('captureSource', () => {
    test('processes source events from a readable stream', async () => {
        await expect(runCapture([
            { type: 'start' },
            { content: 'first write', time: 0 },
            { content: `${ansi.eraseLine}${ansi.cursorColumn(0)}second write`, time: 500 },
            { type: 'finish', time: 600 },
        ], { endTimePadding: 400 })).resolves.toMatchObject<PartialCaptureData>({
            content: [
                { time: 0, endTime: 500, lines: [makeLine('first write')] },
                { time: 500, endTime: 1000, lines: [makeLine('second write')] },
            ],
            cursor: [
                { time: 0, endTime: 500, ...makeCursor(0, 11) },
                { time: 500, endTime: 1000, ...makeCursor(0, 12) },
            ],
            duration: 1000,
        });
    });

    test('return no cursor keyframes if cursor is hidden', async () => {
        const data = await runCapture([
            { type: 'start' },
            { content: 'first write', time: 0 },
            { content: 'second write', time: 500 },
            { type: 'finish', time: 500 },
        ], { cursorHidden: true });
        expect(data.cursor).toHaveLength(0);
    });

    test('capture title keyframes when window title and icon changes', async () => {
        const { title } = await runCapture([
            { type: 'start' },
            { content: '\x1b]1;shell\x07', time: 0 },
            { content: '\x1b]2;window title\x07', time: 500 },
            { content: '\x1b]2;window title without icon\x07\x1b]1;\x07', time: 1000 },
            { type: 'finish', time: 1000 },
        ]);
        expect(title).toEqual<TitleKeyFrame[]>([
            { time: 0, endTime: 500, ...resolveTitle(palette, undefined, 'shell') },
            { time: 500, endTime: 1000, ...resolveTitle(palette, 'window title', 'shell') },
            { time: 1000, endTime: 1500, ...resolveTitle(palette, 'window title without icon') },
        ]);
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
                content: [
                    { time: 0, endTime: 500, lines: [makeLine('first write')] },
                    { time: 500, endTime: 1000, lines: [makeLine('second write')] },
                ],
                cursor: [
                    { time: 0, endTime: 500, ...makeCursor(0, 11) },
                    { time: 500, endTime: 1000, ...makeCursor(0, 12) },
                ],
                duration: 1000,
            });
        });

        test('time adjustments prevent consecutive writes from being merged', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write\n', time: 0 },
                { content: 'second write\n', time: 5, adjustment: 500 },
                { type: 'finish', time: 100, adjustment: 500 },
            ], { endTimePadding: 400 })).resolves.toMatchObject<PartialCaptureData>({
                content: [
                    { time: 0, endTime: 505, lines: [makeLine('first write')] },
                    { time: 505, endTime: 1000, lines: [makeLine('first write'), makeLine('second write')] },
                ],
                cursor: [
                    { time: 0, endTime: 505, ...makeCursor(1, 0) },
                    { time: 505, endTime: 1000, ...makeCursor(2, 0) },
                ],
                duration: 1000,
            });
        });
    });

    describe('start delay', () => {
        test('delayed first write when `cropStartDelay` is disabled', async () => {
            const { content } = await runCapture([
                { type: 'start' },
                { content: 'first write', time: 500 },
                { type: 'finish', time: 1000 },
            ], { cropStartDelay: false, endTimePadding: 0, cursorHidden: true });
            expect(content).toEqual<ContentKeyFrame[]>([
                { time: 0, endTime: 500, lines: [] },
                { time: 500, endTime: 1000, lines: [{ index: 0, ...makeLine('first write') }] },
            ]);
        });

        test('delayed first write when `cropStartDelay` is enabled', async () => {
            const { content } = await runCapture([
                { type: 'start' },
                { content: 'first write', time: 500 },
                { type: 'finish', time: 1000 },
            ], { cropStartDelay: true, endTimePadding: 0, cursorHidden: true });
            expect(content).toEqual<ContentKeyFrame[]>([
                { time: 0, endTime: 500, lines: [{ index: 0, ...makeLine('first write') }] },
            ]);
        });

        test('start delay cropping does not apply to time adjustments on the first write', async () => {
            const { content } = await runCapture([
                { type: 'start' },
                { content: 'first write', time: 500, adjustment: 500 },
                { type: 'finish', time: 1000, adjustment: 500 },
            ], { cropStartDelay: true, endTimePadding: 0, cursorHidden: true });
            expect(content).toEqual<ContentKeyFrame[]>([
                { time: 0, endTime: 500, lines: [] },
                { time: 500, endTime: 1000, lines: [{ index: 0, ...makeLine('first write') }] },
            ]);
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
                cursorHidden: true,
            })).resolves.toMatchObject<PartialCaptureData>({
                content: [
                    { time: 0, endTime: 100, lines: [makeLine('> ')] },
                    { time: 100, endTime: 200, lines: [makeLine('> l')] },
                    { time: 200, endTime: 400, lines: [makeLine('> ls')] },
                    { time: 400, endTime: 1400, lines: [makeLine('> ls'), makeLine('first write')] },
                ],
                cursor: [
                    { time: 0, endTime: 100, ...makeCursor(0, 2) },
                    { time: 100, endTime: 200, ...makeCursor(0, 3) },
                    { time: 200, endTime: 300, ...makeCursor(0, 4) },
                    { time: 300, endTime: 400, ...makeCursor(1, 0) },
                ],
                duration: 1400,
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
                content: [
                    { time: 0, endTime: 500, lines: [makeLine('> ls'), makeLine('first write')] },
                ],
                cursor: [
                    { time: 0, endTime: 500, ...makeCursor(1, 11) },
                ],
                duration: 500,
            });
        });
    });

    describe('source streams with no write events', () => {
        const emptyData: CaptureData = {
            content: [],
            cursor: [],
            title: [],
            duration: 0,
        };

        test('source only emits finish event', async () => {
            await expect(runCapture([
                { type: 'finish', time: 0 },
            ])).resolves.toEqual<CaptureData>(emptyData);
        });

        test('source emits a start event followed immediately by a finish event', async () => {
            await expect(runCapture([
                { type: 'start' },
                { type: 'finish', time: 0 },
            ], { endTimePadding: 0 })).resolves.toEqual<CaptureData>(emptyData);
        });

        test('delayed finish immediately following start when `cropStartDelay` is enabled', async () => {
            await expect(runCapture([
                { type: 'start' },
                { type: 'finish', time: 500 },
            ], { cropStartDelay: true, endTimePadding: 0 })).resolves.toEqual<CaptureData>(emptyData);
        });

        test('delayed finish immediately following start when `cropStartDelay` is disabled', async () => {
            await expect(runCapture([
                { type: 'start' },
                { type: 'finish', time: 500 },
            ], { cropStartDelay: false, endTimePadding: 0 })).resolves.toEqual<CaptureData>({
                content: [
                    { time: 0, endTime: 500, lines: [] },
                ],
                cursor: [
                    { time: 0, endTime: 500, ...makeCursor(0, 0) },
                ],
                title: [],
                duration: 500,
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
                content: [
                    { time: 0, endTime: 100, lines: [makeLine('> ')] },
                    { time: 100, endTime: 200, lines: [makeLine('> l')] },
                    { time: 200, endTime: 900, lines: [makeLine('> ls')] },
                ],
                cursor: [
                    { time: 0, endTime: 100, ...makeCursor(0, 2) },
                    { time: 100, endTime: 200, ...makeCursor(0, 3) },
                    { time: 200, endTime: 300, ...makeCursor(0, 4) },
                    { time: 300, endTime: 900, ...makeCursor(1, 0) },
                ],
                duration: 900,
            });
        });
    });
});