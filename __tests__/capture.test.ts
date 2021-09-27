import type { DeepPartial, CaptureData } from '@src/types';
import { resolveTheme } from '@src/theme';
import RecordingStream from '@src/source';
import captureSource, { ScreenCaptureOptions } from '@src/capture';
import * as ansi from './helpers/ansi';

const { palette } = resolveTheme();

const defaultOptions: ScreenCaptureOptions = {
    columns: 50,
    rows: 10,
    tabSize: 8,
    palette,
};

function runCapture(cb: (source: RecordingStream) => void, options?: Partial<ScreenCaptureOptions>) {
    const source = new RecordingStream(),
        capture = captureSource(source, { ...defaultOptions, ...options });
    cb(source);
    return capture;
}

const anyKeyframe = <T>(props: T) => ({
    time: expect.any(Number) as number,
    endTime: expect.any(Number) as number,
    ...props,
});

type PartialCaptureData = DeepPartial<CaptureData>;

describe('captureSource', () => {
    test('process events written from a recording source', async () => {
        await expect(runCapture((source) => {
            source.start();
            source.write('first write');
            source.wait(500);
            source.write(ansi.eraseLine + ansi.cursorColumn(0));
            source.write('second write');
            source.finish();
        })).resolves.toMatchObject<PartialCaptureData>({
            content: [
                { lines: [{ chunks: [{ str: 'first write', x: [0, 11] }] }] },
                { lines: [{ chunks: [{ str: 'second write', x: [0, 12] }] }] },
            ],
            cursor: [
                { line: 0, column: 11, hidden: false },
                { line: 0, column: 12, hidden: false },
            ],
        });
    });

    test('merge consecutive writes whose time difference is less than `writeMergeThreshold`', async () => {
        await expect(runCapture((source) => {
            source.start();
            source.write('first write');
            source.wait(500);
            source.write(ansi.cursorColumn(0));
            source.wait(500);
            source.write('second write');
            source.finish();
        })).resolves.toMatchObject<PartialCaptureData>({
            content: [
                { lines: [{ chunks: [{ str: 'first write', x: [0, 11] }] }] },
                { lines: [{ chunks: [{ str: 'second write', x: [0, 12] }] }] },
            ],
            cursor: [
                { line: 0, column: 11 },
                { line: 0, column: 0 },
                { line: 0, column: 12 },
            ],
        });
    });

    test('return no cursor keyframes if cursor is hidden', async () => {
        const data = await runCapture((source) => {
            source.start();
            source.write('first write');
            source.wait(500);
            source.write('second write');
            source.finish();
        }, { ...defaultOptions, cursorHidden: true });
        expect(data.cursor).toHaveLength(0);
    });

    test('capture title keyframes when window title and icon changes', async () => {
        const { title } = await runCapture((source) => {
            source.write('\x1b]1;shell\x07');
            source.wait(500);
            source.write('\x1b]2;window title\x07');
            source.wait(500);
            source.setTitle('window title without icon', '');
            source.finish();
        }, defaultOptions);
        expect(title).toEqual([
            anyKeyframe({ icon: 'shell' }),
            anyKeyframe({ icon: 'shell', text: 'window title' }),
            anyKeyframe({ text: 'window title without icon' }),
        ]);
    });

    test('do not remove time between start and first write when `cropStartDelay` is false', async () => {
        await expect(runCapture((source) => {
            source.start();
            source.wait(500);
            source.write('first write');
            source.finish();
        }, { cursorHidden: true, cropStartDelay: false })).resolves.toMatchObject<PartialCaptureData>({
            content: [
                { time: 0, lines: [] },
                { time: expect.toBeApprox(500, 5), lines: [{ chunks: [{ str: 'first write' }] }] },
            ],
        });
    });

    describe('empty recording sources', () => {
        const emptyData: CaptureData = {
            content: [],
            cursor: [],
            title: [],
            duration: 0,
        };

        test('source only emits finish event', async () => {
            await expect(runCapture((source) => {
                source.finish();
            })).resolves.toEqual(emptyData);
        });

        test('source emits no write events', async () => {
            await expect(runCapture((source) => {
                source.start();
                source.finish();
            }, { endTimePadding: 0 })).resolves.toEqual(emptyData);
        });
    });
});