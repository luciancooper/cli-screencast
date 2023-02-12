import fs from 'fs';
import { EventEmitter } from 'events';
import type { SfntHeader } from './types';

interface QueuedPromise<T> {
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: any) => void
}

export default class FontReader extends EventEmitter {
    readonly filePath: string;

    private readonly io_queue: QueuedPromise<boolean>[] = [];

    private _fd: number | null = null;

    private performing_io = false;

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
    protected async executeRead(
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

    /**
     * Reads the data from a collection subfont
     */
    async readFont(header: SfntHeader): Promise<Buffer> {
        try {
            // calculate byte length of subfont
            const tableOffsets: number[] = [];
            let bytes = 12 + header.tables.length * 16;
            for (const table of header.tables) {
                tableOffsets.push(bytes);
                bytes += table.bytes;
            }
            // allocate a dest buffer to write extracted subfont to
            const buf = Buffer.alloc(bytes);
            // encode header fields
            buf.writeInt32BE(header.signature, 0);
            buf.writeUInt16BE(header.numTables, 4);
            buf.writeUInt16BE(header.searchRange, 6);
            buf.writeUInt16BE(header.entrySelector, 8);
            buf.writeUInt16BE(header.rangeShift, 10);
            // encode each table & table record
            for (const [i, table] of header.tables.entries()) {
                // get the remapped offset for this table
                const offset = tableOffsets[i]!;
                // copy table bytes from file to the dest bufer
                await this.executeRead(buf, offset, table.bytes, table.offset);
                // encode table record
                buf.writeUInt32BE(table.tag, 12 + i * 16);
                buf.writeUInt32BE(table.checksum, 14 + i * 16);
                buf.writeUInt32BE(offset, 16 + i * 16);
                buf.writeUInt32BE(table.bytes, 18 + i * 16);
            }
            return buf;
        } finally {
            await this.close();
        }
    }
}