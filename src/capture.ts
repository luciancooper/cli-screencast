import { Writable, type Readable } from 'stream';
import { splitChars } from 'tty-strings';
import type { TerminalOptions, TerminalLine, CursorLocation, Title, CaptureData } from './types';
import type { WriteEvent, FinishEvent, SourceEvent } from './source';
import { parse, resolveTitle, type ParseContext, type ParseState } from './parser';
import { clone } from './utils';
import serialize from './serialize';

interface BufferedWrite {
    time: number
    content: string
}

export interface CaptureOptions {
    /**
     * Include the command prompt string at the beginning of the captured recording if it is present in the source
     * stream. Applies when capturing the output of a child process, or if a `command` string is passed to the `start`
     * method of a TerminalSession class instance.
     * @defaultValue `true`
     */
    captureCommand?: boolean

    /**
     * The prompt prefix string to use when a command is captured. Only applicable if `captureCommand` is `true`.
     * @defaultValue `'> '`
     */
    prompt?: string

    /**
     * Include a command input keystroke animation at the start of the recording if command prompt line is captured.
     * Only applicable if `captureCommand` is `true`.
     * @defaultValue `true`
     */
    keystrokeAnimation?: boolean

    /**
     * The delay in milliseconds between keystrokes to use when creating a command input animation. Only applicable if
     * `keystrokeAnimation` is `true`.
     * @defaultValue `140`
     */
    keystrokeAnimationInterval?: number

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

export interface ScreenCaptureOptions extends Required<TerminalOptions & CaptureOptions>, ParseContext {}

export class ScreenCapture extends Writable {
    private started = false;

    data: CaptureData = {
        content: [],
        cursor: [],
        title: [],
        duration: NaN,
    };

    private buffered: BufferedWrite | null = null;

    private addedTime = 0;

    private cropAdjustment = 0;

    private readonly state: ParseState;

    private lastContent: { time: number, serialized: string, state: TerminalLine[] };

    private lastCursor: { time: number, loc: CursorLocation | null };

    private lastTitle: { time: number, serialized: string, state: Title };

    mergeThreshold: number;

    cropStartDelay: boolean;

    endTimePadding: number;

    cursorHidden: boolean;

    captureCommand: boolean;

    prompt: string;

    keystrokeAnimation: boolean;

    keystrokeInterval: number;

    context: ParseContext;

    constructor({
        cursorHidden,
        windowTitle,
        windowIcon,
        writeMergeThreshold,
        endTimePadding,
        cropStartDelay,
        captureCommand,
        prompt,
        keystrokeAnimation,
        keystrokeAnimationInterval,
        ...context
    }: ScreenCaptureOptions) {
        super({ objectMode: true });
        // set options
        this.mergeThreshold = writeMergeThreshold;
        this.cropStartDelay = cropStartDelay;
        this.endTimePadding = endTimePadding;
        this.cursorHidden = cursorHidden;
        this.captureCommand = captureCommand;
        this.prompt = prompt;
        this.keystrokeAnimation = keystrokeAnimation;
        this.keystrokeInterval = keystrokeAnimationInterval;
        this.context = context;
        // initial state
        const title = resolveTitle(windowTitle, windowIcon);
        this.state = {
            lines: [],
            cursor: { line: 0, column: 0 },
            cursorHidden,
            title,
        };
        this.lastContent = { time: 0, serialized: serialize.lines([]), state: [] };
        this.lastCursor = { time: 0, loc: !cursorHidden ? clone(this.state.cursor) : null };
        this.lastTitle = { time: 0, serialized: serialize.title(title), state: clone(title) };
    }

    private startCapture(command?: string) {
        this.started = true;
        if (!(command && this.captureCommand)) return;
        const { state, keystrokeAnimation, keystrokeInterval } = this;
        // if keystrokeAnimation is false, just update initial content
        if (!keystrokeAnimation) {
            // set initial content
            parse(this.context, state, `${this.prompt}${command}\n`);
            this.pushContent(0, state.lines);
            this.pushCursor(0, !state.cursorHidden ? state.cursor : null);
            return;
        }
        // set initial prompt content
        parse(this.context, state, this.prompt);
        // ensure cursor is visible for command capture
        if (state.cursorHidden) parse(this.context, state, '\x1b[?25h');
        // update initial content and cursor
        this.pushContent(0, state.lines);
        this.pushCursor(0, state.cursor);
        // split command chars
        let time = keystrokeInterval;
        for (const char of splitChars(`${command}\n`)) {
            parse(this.context, state, char);
            this.pushContent(time, state.lines);
            this.pushCursor(time, state.cursor);
            time += keystrokeInterval;
        }
        this.addedTime = time;
        // hide cursor if it is hidden at the start of the capture
        if (this.cursorHidden) {
            parse(this.context, state, '\x1b[?25l');
            this.pushCursor(time, null);
        }
    }

    private pushCursor(time: number, cursor: CursorLocation | null) {
        const serialized = serialize.cursor(cursor),
            last = this.lastCursor;
        // compare updated cursor location to the last cursor location
        if (serialize.cursor(last.loc) !== serialized) {
            if (last.loc && time > last.time) {
                this.data.cursor.push({ time: last.time, endTime: time, ...last.loc });
            }
            this.lastCursor = { time, loc: cursor && clone(cursor) };
        }
    }

    private pushContent(time: number, lines: TerminalLine[]) {
        const serialized = serialize.lines(lines),
            last = this.lastContent;
        // compare updated content lines to the last content lines
        if (last.serialized !== serialized) {
            if (time > last.time) {
                this.data.content.push({ time: last.time, endTime: time, lines: last.state });
            }
            this.lastContent = { time, serialized, state: clone(lines) };
        }
    }

    private pushTitle(time: number, title: Title) {
        const serialized = serialize.title(title),
            last = this.lastTitle;
        // compare updated title to the last title
        if (last.serialized !== serialized) {
            if (time > last.time && last.serialized) {
                this.data.title.push({ time: last.time, endTime: time, ...last.state });
            }
            this.lastTitle = { time, serialized, state: clone(title) };
        }
    }

    private pushFrame({ time, content }: BufferedWrite) {
        const { state, addedTime } = this;
        // parse frame content
        parse(this.context, state, content);
        // adjust time to account for time added to the beginning of the capture
        const adjTime = time + addedTime;
        // push content & cursor state
        this.pushContent(adjTime, state.lines);
        this.pushCursor(adjTime, !state.cursorHidden ? state.cursor : null);
        this.pushTitle(adjTime, state.title);
    }

    private finishCapture({ time, adjustment = 0 }: FinishEvent) {
        let duration: number;
        if (!this.started) {
            // capture was never started
            duration = 0;
        } else if (!this.buffered) {
            // capture started, but no writes occurred
            duration = (this.cropStartDelay ? 0 : time) + adjustment + this.addedTime + this.endTimePadding;
        } else {
            // capture started, and at least one write occurred
            this.pushFrame(this.buffered);
            this.buffered = null;
            duration = (time - this.cropAdjustment) + adjustment + this.addedTime + this.endTimePadding;
        }
        this.data.duration = duration;
        const { lastContent: content, lastCursor: cursor, lastTitle: title } = this;
        // add last content keyframe
        if (duration > content.time) {
            this.data.content.push({ time: content.time, endTime: duration, lines: content.state });
        }
        // add last cursor keyframe if cursor is visible or if keyframes array is not empty
        if (duration > cursor.time && cursor.loc) {
            this.data.cursor.push({ time: cursor.time, endTime: duration, ...cursor.loc });
        }
        // add last title keyframe if title is not empty
        if (duration > title.time && title.serialized) {
            this.data.title.push({ time: title.time, endTime: duration, ...title.state });
        }
    }

    private bufferWrite({ time, adjustment = 0, content }: WriteEvent): void {
        const { buffered } = this;
        if (buffered) {
            const adjTime = (time - this.cropAdjustment) + adjustment;
            if (adjTime - buffered.time > this.mergeThreshold) {
                this.pushFrame(buffered);
                this.buffered = { time: adjTime, content };
            } else {
                buffered.content += content;
            }
        } else {
            this.cropAdjustment = this.cropStartDelay ? time : 0;
            this.buffered = { time: (time - this.cropAdjustment) + adjustment, content };
        }
    }

    override _write(event: SourceEvent, enc: BufferEncoding, cb: (error?: Error | null) => void) {
        switch (event.type) {
            case 'start':
                this.startCapture(event.command);
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