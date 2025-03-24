import { Writable, type Readable } from 'stream';
import type { CaptureData } from './types';
import type { StartEvent, WriteEvent, FinishEvent, SourceEvent } from './source';
import { promisifyStream } from './utils';
import log from './logger';

interface BufferedWrite {
    time: number
    content: string
}

export interface CaptureOptions {
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

class CaptureStream extends Writable {
    private started = false;

    private context: Omit<CaptureData, 'writes' | 'endDelay'> | null = null;

    data: CaptureData | null = null;

    private readonly writes: CaptureData['writes'] = [];

    private buffered: BufferedWrite | null = null;

    private lastWriteTime = 0;

    private accAdjustment = 0;

    private cropAdjustment = 0;

    mergeThreshold: number;

    cropStartDelay: boolean;

    endTimePadding: number;

    constructor({ cropStartDelay = true, writeMergeThreshold = 80, endTimePadding = 500 }: CaptureOptions) {
        super({ objectMode: true });
        // set options
        this.mergeThreshold = writeMergeThreshold;
        this.cropStartDelay = cropStartDelay;
        this.endTimePadding = endTimePadding;
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
        // check if this is the first write
        if (!this.buffered) {
            // set adjustment if start delay should be cropped
            if (this.cropStartDelay) this.cropAdjustment = time;
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
        columns,
        rows,
        tabSize,
        cursorHidden,
        windowTitle,
        windowIcon,
        command,
    }: StartEvent) {
        // set capture started flag
        this.started = true;
        // store context for output capture data
        this.context = {
            columns,
            rows,
            tabSize,
            cursorHidden,
            windowTitle,
            windowIcon,
            command,
        };
    }

    private finishCapture({ time, adjustment = 0, content: final }: FinishEvent) {
        // add to accumulated time adjustment
        this.accAdjustment += adjustment;
        // the content field may contain a final write
        const content = typeof final === 'string' ? final : '';
        // process final write
        let adjTime: number;
        if (this.buffered) {
            adjTime = (time - this.cropAdjustment) + this.accAdjustment;
            if (adjTime - this.buffered.time > this.mergeThreshold) {
                this.pushFrame(this.buffered);
                this.pushFrame({ time: adjTime, content });
            } else {
                this.buffered.content += content;
                this.pushFrame(this.buffered);
            }
            this.buffered = null;
        } else {
            // no writes have occured
            adjTime = (this.cropStartDelay ? 0 : time) + this.accAdjustment;
            this.pushFrame({ time: adjTime, content });
        }
        // capture duration
        const duration = adjTime + this.endTimePadding;
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

export default function captureSource(
    source: Readable & PromiseLike<void>,
    props: CaptureOptions,
    ac: AbortController,
) {
    // create capture stream and attach it to the source stream
    const capture = source.pipe(new CaptureStream(props)),
        // create promise that resolves once capture stream has closed
        promise = promisifyStream(capture, ac).then(() => {
            if (capture.data) {
                log.debug('source capture complete');
                return capture.data;
            }
            throw new Error('Incomplete capture - source did not finish');
        });
    // merge source and capture promises
    return Promise.allSettled([source, promise]).then(([sourceResult, captureResult]) => {
        if (sourceResult.status === 'rejected') throw sourceResult.reason;
        if (captureResult.status === 'rejected') throw captureResult.reason;
        return captureResult.value;
    });
}