import { Duplex } from 'stream';
import keys from './keys';

export default class InputStream extends Duplex {
    isTTY = true;

    isRaw = false;

    stdin?: NodeJS.ReadStream;

    stdinInitialRawMode?: boolean;

    constructor(connectStdin: boolean) {
        super({ decodeStrings: false });
        if (connectStdin && process.stdin.isTTY) this.stdin = process.stdin;
    }

    override _read() {}

    override _write(chunk: Buffer | string, enc: BufferEncoding, cb: (error?: Error | null) => void) {
        const content = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk;
        this.push(content, 'utf-8');
        cb();
    }

    setRawMode(mode: boolean): this {
        this.isRaw = mode;
        if (this.stdin) this.stdin.setRawMode(mode);
        return this;
    }

    override pause(): this {
        if (this.stdin) this.stdin.pause();
        return super.pause();
    }

    override resume(): this {
        if (this.stdin) this.stdin.resume();
        return super.resume();
    }

    writeKey(key: string) {
        this.write(keys[key as keyof typeof keys] ?? key);
    }

    hook() {
        if (this.stdin) {
            this.stdin.pipe(this);
            this.stdinInitialRawMode = this.stdin.isRaw;
        }
    }

    unhook() {
        if (this.stdin) {
            this.stdin.unpipe(this);
            this.stdin.setRawMode(this.stdinInitialRawMode!);
        }
    }
}