import { Writable, type Readable } from 'stream';
import { splitChars } from 'tty-strings';
import type { CaptureData } from './types';
import type { StartEvent, WriteEvent, FinishEvent, SourceEvent } from './source';
import { applyDefaults } from './options';
import log from './logger';

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

export const defaultCaptureOptions: Required<CaptureOptions> = {
    writeMergeThreshold: 80,
    endTimePadding: 500,
    cropStartDelay: true,
    captureCommand: true,
    prompt: '> ',
    keystrokeAnimation: true,
    keystrokeAnimationInterval: 100,
};

class CaptureStream extends Writable {
    private started = false;

    private context: Pick<CaptureData, 'columns' | 'rows' | 'tabSize'> | null = null;

    data: CaptureData | null = null;

    private readonly writes: CaptureData['writes'] = [];

    private buffered: BufferedWrite | null = null;

    private lastWriteTime = 0;

    private accAdjustment = 0;

    private cropAdjustment = 0;

    private firstWrite = true;

    mergeThreshold: number;

    cropStartDelay: boolean;

    endTimePadding: number;

    captureCommand: boolean;

    prompt: string;

    keystrokeAnimation: boolean;

    keystrokeInterval: number;

    constructor(options: CaptureOptions) {
        super({ objectMode: true });
        // set options
        const props = applyDefaults(defaultCaptureOptions, options);
        this.mergeThreshold = props.writeMergeThreshold;
        this.cropStartDelay = props.cropStartDelay;
        this.endTimePadding = props.endTimePadding;
        this.captureCommand = props.captureCommand;
        this.prompt = props.prompt;
        this.keystrokeAnimation = props.keystrokeAnimation;
        this.keystrokeInterval = props.keystrokeAnimationInterval;
    }

    private pushFrame({ time, content }: BufferedWrite) {
        // do not push empty writes
        if (!content) return;
        // push write
        this.writes.push({ content, delay: time - this.lastWriteTime });
        // update last write time
        this.lastWriteTime = time;
    }

    private bufferWrite({ time, adjustment = 0, content }: WriteEvent): void {
        // add to accumulated time adjustment
        this.accAdjustment += adjustment;
        // check if there are no previously buffered writes
        if (!this.buffered) {
            // set first buffered write
            this.buffered = { time: (time - this.cropAdjustment) + this.accAdjustment, content };
            return;
        }
        const adjTime = (time - this.cropAdjustment) + this.accAdjustment;
        if (adjTime - this.buffered.time > this.mergeThreshold) {
            this.pushFrame(this.buffered);
            this.buffered = { time: adjTime, content };
        } else {
            this.buffered.content += content;
        }
    }

    private startCapture({
        command,
        columns,
        rows,
        tabSize,
        cursorHidden,
        windowTitle,
        windowIcon,
    }: StartEvent) {
        // set capture started flag
        this.started = true;
        // store context for output capture data
        this.context = { columns, rows, tabSize };
        // determine initial window title / icon escape
        let windowEscape = '';
        if (windowTitle) {
            windowEscape = windowIcon ? (
                typeof windowIcon === 'string' ? `\x1b]2;${windowTitle}\x07\x1b]1;${windowIcon}\x07`
                    : `\x1b]0;${windowTitle}\x07`
            ) : `\x1b]2;${windowTitle}\x07`;
        } else if (windowIcon) {
            windowEscape = `\x1b]1;${typeof windowIcon === 'string' ? windowIcon : '_'}\x07`;
        }
        // initial cursor visibility escape
        const cursorEscape = cursorHidden ? '\x1b[?25l' : '';
        if (!(command && this.captureCommand)) {
            const esc = windowEscape + cursorEscape;
            if (esc) this.bufferWrite({ time: 0, content: esc });
            return;
        }
        const { keystrokeAnimation, keystrokeInterval } = this;
        // if keystrokeAnimation is false, just update initial content
        if (!keystrokeAnimation) {
            // set initial content
            const content = `${windowEscape}${cursorEscape}${this.prompt}${command}\n`;
            this.bufferWrite({ time: 0, content });
            return;
        }
        // buffer initial prompt content
        this.bufferWrite({ time: 0, content: windowEscape + this.prompt });
        // split command chars
        for (const char of splitChars(`${command}\n`)) {
            this.bufferWrite({ time: 0, adjustment: keystrokeInterval, content: char });
        }
        // hide cursor if it is hidden at the start of the capture
        this.bufferWrite({ time: 0, adjustment: keystrokeInterval, content: cursorEscape });
    }

    private finishCapture({ time, adjustment = 0 }: FinishEvent) {
        // add to accumulated time adjustment
        this.accAdjustment += adjustment;
        // process buffered writes
        if (this.buffered) {
            this.pushFrame(this.buffered);
            this.buffered = null;
        }
        // capture duration
        const duration = (time - this.cropAdjustment) + this.accAdjustment + this.endTimePadding;
        // create capture data
        this.data = {
            ...this.context!,
            writes: this.writes,
            endDelay: duration - this.lastWriteTime,
        };
    }

    override _write(event: SourceEvent, enc: BufferEncoding, cb: (error?: Error | null) => void) {
        let err: Error | undefined;
        try {
            // ensure capture has not already been finished
            if (this.data) {
                throw new Error('Capture already finished');
            }
            if (event.type === 'start') {
                // ensure this is not a duplicate start event
                if (this.started) {
                    throw new Error('Capture has already started');
                }
                // start capture
                this.startCapture(event);
            } else {
                // ensure capture has started
                if (!this.started) {
                    throw new Error('Capture has not started');
                }
                // set crop adjustment if this is the first event after start
                if (this.firstWrite) {
                    this.cropAdjustment = this.cropStartDelay ? event.time : 0;
                    this.firstWrite = false;
                }
                if (event.type === 'finish') {
                    this.finishCapture(event);
                } else {
                    this.bufferWrite(event);
                }
            }
        } catch (error) {
            err = error as Error;
        }
        cb(err);
    }
}

export default function captureSource(source: Readable | (Readable & PromiseLike<any>), props: CaptureOptions) {
    const promise = new Promise<CaptureData>((resolve, reject) => {
        const capture = source.pipe(new CaptureStream(props));
        capture.on('finish', () => {
            if (capture.data) {
                log.debug('source capture complete');
                resolve(capture.data);
            } else reject(new Error('Incomplete capture - source did not emit finish'));
        });
        capture.on('error', reject);
    });
    return Promise.all([promise, source]).then(([data]) => data);
}