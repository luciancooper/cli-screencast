import fs from 'fs';
import { EventEmitter } from 'events';
import { TextDecoder } from 'util';

interface QueuedPromise<T> {
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: any) => void
}

const utf16Decoder = new TextDecoder('utf-16be');

export default class FontReader extends EventEmitter {
    readonly filePath: string;

    private readonly io_queue: QueuedPromise<boolean>[] = [];

    private _fd: number | null = null;

    private performing_io = false;

    /** buffer that holds the data currently being read from the underlying file */
    protected buf: Buffer;

    /** starting position of the buffered data within the underlying file */
    protected fd_pos = 0;

    protected fd_eof = false;

    /** current position within the buffer */
    protected buf_pos = 0;

    /** number of bytes read into the buffer */
    protected buf_bytes = 0;

    /** Used to adjust relative pointers */
    protected fd_offset = 0;

    constructor(filePath: string) {
        super();
        this.filePath = filePath;
        // set up io_queue listeners
        this.on('readable', () => {
            if (!this.io_queue.length) return;
            const next = this.io_queue.shift()!;
            next.resolve(this.performing_io);
        });
        this.on('error', (error) => {
            while (this.io_queue.length) {
                const next = this.io_queue.shift()!;
                next.reject(error);
            }
        });
        this.on('closed', () => {
            while (this.io_queue.length) {
                const next = this.io_queue.shift()!;
                next.reject(new Error('File is closed'));
            }
        });
        // allocate an empty buffer
        this.buf = Buffer.alloc(0);
    }

    private queueIO(): Promise<boolean> {
        if (!this.performing_io) {
            return Promise.resolve(this.performing_io);
        }
        return new Promise<boolean>((resolve, reject) => {
            this.io_queue.push({ resolve, reject });
        });
    }

    /**
     * Get the file descriptor, opening the underlying font file if it is closed
     */
    private async fd(): Promise<number> {
        // fsPromises.open(path, flags[, mode])
        if (this._fd != null) {
            return this._fd;
        }
        return this.queueIO().then(() => new Promise<number>((resolve, reject) => {
            this.performing_io = true;
            fs.open(this.filePath, 'r', (err, fd) => {
                this.performing_io = false;
                if (err) {
                    this.emit('error', err);
                    reject(err);
                } else {
                    this._fd = fd;
                    this.emit('readable');
                    resolve(fd);
                }
            });
        }));
    }

    /**
     * Closes the file handle
     */
    protected async close(): Promise<void> {
        if (this._fd == null) {
            return;
        }
        return this.queueIO().then(() => new Promise((resolve, reject) => {
            this.performing_io = true;
            fs.close(this._fd!, (err: NodeJS.ErrnoException | null) => {
                this.performing_io = false;
                if (err) {
                    // failed to close stream
                    this.emit('error', err);
                    reject(err);
                } else {
                    this._fd = null;
                    this.emit('closed');
                    resolve();
                }
            });
        }));
    }

    /**
     * Read data from the underlying font file
     * @param buffer - The buffer that data will be written to
     * @param offset - Position in `buffer` to write the data to.
     * @param bytes - Number of bytes to read
     * @param fdpos - Position in the file to begin reading from
     */
    private async executeRead(
        buffer: Buffer,
        offset: number,
        bytes: number,
        fdpos: number,
    ): Promise<{ bytesRead: number, eof: boolean }> {
        // get file descriptor
        const fd = await this.fd();
        // queue io operation
        return this.queueIO().then<{ bytesRead: number, eof: boolean }>(() => new Promise((resolve, reject) => {
            // lock thread
            this.performing_io = true;
            // initiate file read
            fs.read(fd, buffer, offset, bytes, fdpos, (err, bytesRead) => {
                // unlock thread
                this.performing_io = false;
                if (err) {
                    this.emit('error', err);
                    reject(err);
                } else {
                    this.emit('readable');
                    resolve({ bytesRead, eof: bytesRead === 0 });
                }
            });
        })).then((r) => ((r.bytesRead < bytes && !r.eof) ? (
            this.executeRead(buffer, offset + r.bytesRead, bytes - r.bytesRead, fdpos + r.bytesRead)
                .then((nextRead) => ({ ...nextRead, bytesRead: r.bytesRead + nextRead.bytesRead }))
        ) : r));
    }

    protected async read(bytes: number, offset?: number) {
        // byte index range of data to be read
        const f1 = offset != null ? this.fd_offset + offset : this.fd_pos + this.buf_pos,
            f2 = f1 + bytes;
        // check if requested byte range has already been read
        if (f1 >= this.fd_pos && f2 <= this.fd_pos + this.buf_bytes) {
            // if offset arg was provided, update buffer position
            if (offset != null) this.buf_pos = f1 - this.fd_pos;
            return;
        }
        // allocate a new buffer
        const buf = Buffer.alloc(bytes);
        let [read_pos, read_bytes, extra_bytes] = [f1, bytes, 0];
        // handle overlaps between current buffer and byte read span
        if (f1 >= this.fd_pos && f1 < this.fd_pos + this.buf_bytes) {
            // copy overlapping bytes to the beginning of the new buffer
            this.buf.copy(buf, 0, f1 - this.fd_pos, this.buf_bytes);
            // update buffer byte length
            this.buf_bytes = this.fd_pos + this.buf_bytes - f1;
            // update read position + read byte count
            [read_pos, read_bytes] = [read_pos + this.buf_bytes, read_bytes - this.buf_bytes];
        } else if (f1 < this.fd_pos && f2 > this.fd_pos) {
            // copy overlapping bytes to the end of the new buffer
            this.buf.copy(buf, this.fd_pos - f1, 0, f2 - this.fd_pos);
            // reset buffer byte length
            this.buf_bytes = 0;
            // store overlapping byte count
            [extra_bytes, read_bytes] = [f2 - this.fd_pos, this.fd_pos - f1];
        } else {
            // reset buffer byte length
            this.buf_bytes = 0;
        }
        // set the byte index position in the source file
        this.fd_pos = f1;
        // reset the byte position in the buffer
        this.buf_pos = 0;
        // replace the active buffer
        this.buf = buf;
        // execute read
        const { bytesRead, eof } = await this.executeRead(buf, this.buf_bytes, read_bytes, read_pos);
        this.fd_eof = eof;
        this.buf_bytes += bytesRead + extra_bytes;
    }

    protected setPointer(pointer: number) {
        const pos = this.fd_offset + pointer;
        if (pos < this.fd_pos || pos > this.fd_pos + this.buf_bytes) {
            if (pos < 0) throw new Error(`Invalid pointer: ${pointer}`);
            this.fd_pos = pos;
            this.buf_pos = 0;
            this.buf_bytes = 0;
        } else this.buf_pos = pos - this.fd_pos;
    }

    protected skip(bytes: number): this {
        this.buf_pos += bytes;
        return this;
    }

    protected uint8() {
        const int = this.buf.readUInt8(this.buf_pos);
        this.buf_pos += 1;
        return int;
    }

    protected int16() {
        const int = this.buf.readInt16BE(this.buf_pos);
        this.buf_pos += 2;
        return int;
    }

    protected uint16() {
        const int = this.buf.readUInt16BE(this.buf_pos);
        this.buf_pos += 2;
        return int;
    }

    protected uint32() {
        const int = this.buf.readUInt32BE(this.buf_pos);
        this.buf_pos += 4;
        return int;
    }

    protected fixed32() {
        const [whole, frac] = [this.uint16(), this.uint16()];
        return whole + frac / (2 ** 16);
    }

    protected array<T>(length: number, cb: () => T): T[] {
        const array: T[] = [];
        for (let i = 0; i < length; i += 1) array.push(cb.call(this));
        return array;
    }

    protected utf8(bytes: number) {
        const str = this.buf.toString('utf-8', this.buf_pos, this.buf_pos + bytes);
        this.buf_pos += bytes;
        return str;
    }

    protected utf16(bytes: number) {
        const str = utf16Decoder.decode(this.buf.subarray(this.buf_pos, this.buf_pos + bytes));
        this.buf_pos += bytes;
        return str;
    }

    protected string(bytes: number, encoding: string) {
        const span = this.buf.subarray(this.buf_pos, this.buf_pos + bytes);
        this.buf_pos += bytes;
        try {
            return new TextDecoder(encoding).decode(span);
        } catch (err) {
            return utf16Decoder.decode(span);
        }
    }

    /**
     * convert a 4 char tag value to its uint32 value
     */
    protected tagUInt32(tag: string): number {
        let int = 0;
        for (let i = 0; i < 4; i += 1) int |= (tag.charCodeAt(i) & 0xFF) << 8 * (3 - i);
        return int;
    }
}