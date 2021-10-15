import { Writable } from 'stream';
import type { WriteData, TerminalLine, CursorLocation, Title, ScreenData, CaptureData } from './types';
import RecordingStream, { SourceEvent } from './source';
import { resolveTitle } from './title';
import parse, { ParseContext } from './parse';
import { clone } from './utils';
import serialize from './serialize';

export interface CaptureOptions {
    /**
     * Whether cursor is hidden at the start of the capture
     * @defaultValue `false`
     */
    cursorHidden?: boolean

    /**
     * Terminal window title at the start of the capture
     * @defaultValue `undefined`
     */
    windowTitle?: string

    /**
     * Terminal window icon at the start of the capture
     * @defaultValue `undefined`
     */
    windowIcon?: string | boolean

    /**
     * Consecutive writes will be merged if they occur within this number of milliseconds of each other.
     * @defaultValue `80`
     */
    writeMergeThreshold?: number

    /**
     * Milliseconds to add to the end of the capture
     * @defaultValue `500`
     */
    endTimePadding?: number

    /**
     * Remove the time difference between the start of the capture and the first write.
     * @defaultValue `true`
     */
    cropStartDelay?: boolean
}

export type ScreenCaptureOptions = ParseContext & CaptureOptions;

export class ScreenCapture extends Writable {
    private started = false;

    data: CaptureData = {
        content: [],
        cursor: [],
        title: [],
        duration: NaN,
    };

    private buffered: WriteData | null = null;

    private startDelay = 0;

    private screenState: ScreenData;

    private lastContent: { time: number, serialized: string, state: TerminalLine[] };

    private lastCursor: { time: number, serialized: string, state: CursorLocation };

    private lastTitle: { time: number, serialized: string, state: Title };

    mergeThreshold: number;

    cropStartDelay: boolean;

    endTimePadding: number;

    context: ParseContext;

    constructor({
        writeMergeThreshold = 80,
        endTimePadding = 500,
        cropStartDelay = true,
        cursorHidden = false,
        windowTitle,
        windowIcon,
        ...context
    }: ScreenCaptureOptions) {
        super({ objectMode: true });
        // set options
        this.mergeThreshold = writeMergeThreshold;
        this.cropStartDelay = cropStartDelay;
        this.endTimePadding = endTimePadding;
        this.context = context;
        // initial state
        const cursor = { line: 0, column: 0, hidden: cursorHidden },
            title = resolveTitle(context.palette, windowTitle, windowIcon);
        this.screenState = { lines: [], cursor, title };
        this.lastContent = { time: 0, serialized: serialize.lines([]), state: [] };
        this.lastCursor = { time: 0, serialized: serialize.cursor(cursor), state: cursor };
        this.lastTitle = { time: 0, serialized: serialize.title(title), state: title };
    }

    private pushCursor(time: number, state: CursorLocation) {
        const serialized = serialize.cursor(state),
            last = this.lastCursor;
        // compare updated cursor location to the last cursor location
        if (last.serialized !== serialized) {
            if (time > last.time) {
                this.data.cursor.push({ time: last.time, endTime: time, ...last.state });
            }
            this.lastCursor = { time, state, serialized };
        }
    }

    private pushContent(time: number, state: TerminalLine[]) {
        const serialized = serialize.lines(state),
            last = this.lastContent;
        // compare updated content lines to the last content lines
        if (last.serialized !== serialized) {
            if (time > last.time) {
                this.data.content.push({ time: last.time, endTime: time, lines: last.state });
            }
            this.lastContent = { time, state, serialized };
        }
    }

    private pushTitle(time: number, state: Title) {
        const serialized = serialize.title(state),
            last = this.lastTitle;
        // compare updated title to the last title
        if (last.serialized !== serialized) {
            if (time > last.time && last.serialized) {
                this.data.title.push({ time: last.time, endTime: time, ...last.state });
            }
            this.lastTitle = { time, serialized, state };
        }
    }

    private pushFrame({ time, content }: WriteData) {
        const state = this.screenState;
        // parse frame content
        parse(this.context, state, content);
        // push content & cursor state
        this.pushContent(time, state.lines);
        this.pushCursor(time, state.cursor);
        this.pushTitle(time, state.title);
        // clone state
        this.screenState = clone(state);
    }

    private finishCapture(duration: number) {
        this.data.duration = duration;
        const { lastContent: content, lastCursor: cursor, lastTitle: title } = this;
        // add last content keyframe
        if (duration > content.time) {
            this.data.content.push({ time: content.time, endTime: duration, lines: content.state });
        }
        // add last cursor keyframe if cursor is visible or if keyframes array is not empty
        if ((!cursor.state.hidden || this.data.cursor.length) && duration > cursor.time) {
            this.data.cursor.push({ time: cursor.time, endTime: duration, ...cursor.state });
        }
        // add last title keyframe if title is not empty
        if (title.serialized && duration > title.time) {
            this.data.title.push({ time: title.time, endTime: duration, ...title.state });
        }
    }

    private bufferWrite({ time, content }: WriteData): void {
        const { buffered } = this;
        if (buffered) {
            const adjTime = time - this.startDelay;
            if (adjTime - buffered.time > this.mergeThreshold) {
                this.pushFrame(buffered);
                this.buffered = { time: adjTime, content };
            } else {
                buffered.content += content;
            }
        } else {
            this.startDelay = this.cropStartDelay ? time : 0;
            this.buffered = { time: time - this.startDelay, content };
        }
    }

    private flushBuffered(): boolean {
        const { buffered } = this;
        if (!buffered) return false;
        if (buffered.content) this.pushFrame(buffered);
        this.buffered = null;
        return true;
    }

    override _write(event: SourceEvent, enc: BufferEncoding, cb: (error?: Error | null) => void) {
        switch (event.type) {
            case 'start':
                this.started = true;
                break;
            case 'write':
                this.bufferWrite(event);
                break;
            case 'finish':
                this.finishCapture(
                    (this.started && this.flushBuffered()) ? event.time - this.startDelay + this.endTimePadding : 0,
                );
                break;
            // no default
        }
        cb();
    }
}

export default function captureSource(source: RecordingStream, props: ScreenCaptureOptions) {
    return new Promise<CaptureData>((resolve, reject) => {
        const recording = source.pipe(new ScreenCapture(props));
        recording.on('finish', () => {
            resolve(recording.data);
        });
        recording.on('error', reject);
    });
}