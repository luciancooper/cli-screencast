import type { DeepPartial, CaptureData, ContentRecordingFrame } from '@src/types';
import { resolveTheme } from '@src/theme';
import type { SourceEvent } from '@src/source';
import captureSource, { ScreenCaptureOptions } from '@src/capture';
import { makeLine, makeCursor } from './helpers/objects';
import { objectStream } from './helpers/streams';
import * as ansi from './helpers/ansi';

const { palette } = resolveTheme();

const defaultOptions: ScreenCaptureOptions = {
    columns: 50,
    rows: 10,
    tabSize: 8,
    palette,
};

function runCapture(events: SourceEvent[], options?: Partial<ScreenCaptureOptions>) {
    const readable = objectStream<SourceEvent>(events);
    return captureSource(readable, { ...defaultOptions, ...options });
}

type PartialCaptureData = DeepPartial<CaptureData>;

describe('captureSource', () => {
    test('processes source events from a readable stream', async () => {
        await expect(runCapture([
            { type: 'start' },
            { content: 'first write', time: 0 },
            { content: `${ansi.eraseLine}${ansi.cursorColumn(0)}second write`, time: 500 },
            { type: 'finish', time: 600 },
        ])).resolves.toMatchObject<PartialCaptureData>({
            content: [
                { lines: [makeLine('first write')] },
                { lines: [makeLine('second write')] },
            ],
            cursor: [
                { line: 0, column: 11, hidden: false },
                { line: 0, column: 12, hidden: false },
            ],
        });
    });

    test('return no cursor keyframes if cursor is hidden', async () => {
        const data = await runCapture([
            { type: 'start' },
            { content: 'first write', time: 0 },
            { content: 'second write', time: 500 },
            { type: 'finish', time: 500 },
        ], { ...defaultOptions, cursorHidden: true });
        expect(data.cursor).toHaveLength(0);
    });

    test('capture title keyframes when window title and icon changes', async () => {
        const { title } = await runCapture([
            { type: 'start' },
            { content: '\x1b]1;shell\x07', time: 0 },
            { content: '\x1b]2;window title\x07', time: 500 },
            { content: '\x1b]2;window title without icon\x07\x1b]1;\x07', time: 1000 },
            { type: 'finish', time: 1000 },
        ], defaultOptions);
        expect(title).toEqual([
            expect.objectContaining({ icon: 'shell', text: undefined }),
            expect.objectContaining({ icon: 'shell', text: 'window title' }),
            expect.objectContaining({ icon: undefined, text: 'window title without icon' }),
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
            ])).resolves.toMatchObject<PartialCaptureData>({
                content: [
                    { lines: [makeLine('first write')] },
                    { lines: [makeLine('second write')] },
                ],
                cursor: [
                    { line: 0, column: 11, hidden: false },
                    { line: 0, column: 12, hidden: false },
                ],
            });
        });

        test('time adjustments prevent consecutive writes from being merged', async () => {
            await expect(runCapture([
                { type: 'start' },
                { content: 'first write\n', time: 0 },
                { content: 'second write\n', time: 5, adjustment: 500 },
                { type: 'finish', time: 100, adjustment: 500 },
            ])).resolves.toMatchObject<PartialCaptureData>({
                content: [
                    { lines: [makeLine('first write')] },
                    { lines: [makeLine('first write'), makeLine('second write')] },
                ],
                cursor: [
                    { line: 1, column: 0, hidden: false },
                    { line: 2, column: 0, hidden: false },
                ],
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
            expect(content).toEqual<ContentRecordingFrame[]>([
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
            expect(content).toEqual<ContentRecordingFrame[]>([
                { time: 0, endTime: 500, lines: [{ index: 0, ...makeLine('first write') }] },
            ]);
        });

        test('start delay cropping does not apply to time adjustments on the first write', async () => {
            const { content } = await runCapture([
                { type: 'start' },
                { content: 'first write', time: 500, adjustment: 500 },
                { type: 'finish', time: 1000, adjustment: 500 },
            ], { cropStartDelay: true, endTimePadding: 0, cursorHidden: true });
            expect(content).toEqual<ContentRecordingFrame[]>([
                { time: 0, endTime: 500, lines: [] },
                { time: 500, endTime: 1000, lines: [{ index: 0, ...makeLine('first write') }] },
            ]);
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
                    { time: 0, endTime: 500, ...makeCursor(0, 0, false) },
                ],
                title: [],
                duration: 500,
            });
        });
    });
});