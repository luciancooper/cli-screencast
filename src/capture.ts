import { Writable } from 'stream';
import type { Readable } from 'stream';
import type { TerminalLine, CursorLocation, Title, ScreenData, CaptureData } from './types';
import type { WriteEvent, FinishEvent, SourceEvent } from './source';
import { resolveTitle } from './title';
import parse, { ParseContext } from './parse';
import { clone } from './utils';
import serialize from './serialize';

interface BufferedWrite {
    time: number
    content: string
}

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

    private buffered: BufferedWrite | null = null;

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

    private pushFrame({ time, content }: BufferedWrite) {
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

    private finishCapture({ time, adjustment = 0 }: FinishEvent) {
        let duration: number;
        if (!this.started) {
            // capture was never started
            duration = 0;
        } else if (!this.buffered) {
            // capture started, but no writes occurred
            duration = (this.cropStartDelay ? 0 : time) + adjustment + this.endTimePadding;
        } else {
            // capture started, and at least one write occurred
            this.pushFrame(this.buffered);
            this.buffered = null;
            duration = (time - this.startDelay) + adjustment + this.endTimePadding;
        }
        this.data.duration = duration;
        const { lastContent: content, lastCursor: cursor, lastTitle: title } = this;
        // add last content keyframe
        if (duration > content.time) {
            this.data.content.push({ time: content.time, endTime: duration, lines: content.state });
        }
        // add last cursor keyframe if cursor is visible or if keyframes array is not empty
        if (duration > cursor.time && (!cursor.state.hidden || this.data.cursor.length)) {
            this.data.cursor.push({ time: cursor.time, endTime: duration, ...cursor.state });
        }
        // add last title keyframe if title is not empty
        if (duration > title.time && title.serialized) {
            this.data.title.push({ time: title.time, endTime: duration, ...title.state });
        }
    }

    private bufferWrite({ time, adjustment = 0, content }: WriteEvent): void {
        const { buffered } = this;
        if (buffered) {
            const adjTime = (time - this.startDelay) + adjustment;
            if (adjTime - buffered.time > this.mergeThreshold) {
                this.pushFrame(buffered);
                this.buffered = { time: adjTime, content };
            } else {
                buffered.content += content;
            }
        } else {
            this.startDelay = this.cropStartDelay ? time : 0;
            this.buffered = { time: (time - this.startDelay) + adjustment, content };
        }
    }

    override _write(event: SourceEvent, enc: BufferEncoding, cb: (error?: Error | null) => void) {
        switch (event.type) {
            case 'start':
                this.started = true;
                break;
            case 'finish':
                this.finishCapture(event);
                break;
            default:
                this.bufferWrite(event);
                break;
        }
        cb();
    }
}

export default function captureSource(source: Readable, props: ScreenCaptureOptions) {
    return new Promise<CaptureData>((resolve, reject) => {
        const recording = source.pipe(new ScreenCapture(props));
        recording.on('finish', () => {
            resolve(recording.data);
        });
        recording.on('error', reject);
    });
}