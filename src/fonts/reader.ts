import { promises as fs } from 'fs';
import { decodeString } from './encoding';

export default class FontReader {
    protected filePath: string | null = null;

    private _handle: fs.FileHandle | null = null;

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

    constructor(filePath?: string) {
        this.filePath = filePath ?? null;
        // allocate an empty buffer
        this.buf = Buffer.alloc(0);
    }

    /**
     * Get the file handle, opening one if it does not currently exist
     */
    private handle(): Promise<fs.FileHandle> {
        if (this._handle) {
            return Promise.resolve(this._handle);
        }
        if (!this.filePath) {
            return Promise.reject(new Error('A target font file has not been specified'));
        }
        return fs.open(this.filePath, 'r').then((handle) => {
            this._handle = handle;
            return handle;
        });
    }

    /**
     * Closes the file handle
     */
    protected close(): Promise<void> {
        if (!this._handle) {
            return Promise.resolve();
        }
        return this._handle.close().then(() => {
            this._handle = null;
            this.filePath = null;
            this.reset();
        });
    }

    protected reset() {
        // clear buffer
        this.buf_bytes = 0;
        this.buf_pos = 0;
        this.buf = Buffer.alloc(0);
        // reset file position
        this.fd_pos = 0;
        this.fd_eof = false;
        // reset pointer offset
        this.fd_offset = 0;
    }

    /**
     * Read data from the underlying font file.
     * If no offset position is provided, data will be read from the current file position.
     * @param bytes - The number of bytes to read
     * @param offset - The file position to start reading from (relative to `fd_position`).
     */
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
        // get file handle for the underlying font file
        const handle = await this.handle();
        // call read on the file handle until all bytes have been read
        for (let b = 0, bytesRead = 0; b < read_bytes; b += bytesRead) {
            ({ bytesRead } = await handle.read(buf, this.buf_bytes, read_bytes - b, read_pos + b));
            // update the count of bytes that have been read into the buffer
            this.buf_bytes += bytesRead;
            // check for end of file
            if (bytesRead === 0) {
                this.fd_eof = true;
                break;
            }
        }
        this.buf_bytes += extra_bytes;
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

    protected uint24() {
        const int = (this.buf.readUInt16BE(this.buf_pos) << 8) + this.buf.readUInt8(this.buf_pos + 2);
        this.buf_pos += 3;
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

    protected string(bytes: number, encoding: string) {
        const str = decodeString(encoding, this.buf, this.buf_pos, bytes);
        this.buf_pos += bytes;
        return str;
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