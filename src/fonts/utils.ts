import { URL } from 'url';
import https from 'https';
import { promises as fs } from 'fs';
import type { SystemFontData, SfntHeader } from './types';
import log from '../logger';

/**
 * Returns a URL instance if input string is a valid url, otherwise returns null
 * @param path - potential url string to parse
 */
export function parseUrl(path: string): URL | null {
    try {
        const url = new URL(path);
        return (url.protocol === 'https:' || url.protocol === 'http:') ? url : null;
    } catch {
        return null;
    }
}

interface FetchResponse {
    /** http status code */
    status: number
    /** 'content-type' response header */
    type?: string
    /** request response data buffer */
    data?: Buffer
}

/**
 * Make a GET request
 * @param req - request url or options object
 * @returns fetched data
 */
export function fetchData(req: string | URL | https.RequestOptions): Promise<FetchResponse> {
    return new Promise((resolve, reject) => {
        https.get(typeof req === 'string' ? encodeURI(req) : req, (res) => {
            const status = res.statusCode!;
            if (status >= 400) {
                res.on('end', () => {
                    resolve({ status });
                });
                res.resume();
                return;
            }
            const chunks: Uint8Array[] = [];
            // handle response chunks
            res.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
            // response complete
            res.on('end', () => {
                const type = res.headers['content-type'] ?? '';
                resolve({ status, type, data: Buffer.concat(chunks) });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

export async function fetchFont(url: URL) {
    try {
        const res = await fetchData(url);
        if (res.status !== 200) {
            log.warn('failed to fetch font: %S, received response status %k', url.href, res.status);
            return null;
        }
        return res.data!;
    } catch (error) {
        log.warn('failed to fetch font: %S:\n  %e', url.href, { error });
        return null;
    }
}

/**
 * Extract a subfont from a ttc font collection and encode it as a standalone font
 */
async function extractTtcFont(file: string | URL, header: SfntHeader): Promise<Buffer | null> {
    // calculate byte length of subfont
    const tableSpans: [destOffset: number, srcOffset: number, bytes: number][] = [];
    let size = 12 + header.tables.length * 16;
    for (const table of header.tables) {
        tableSpans.push([size, table.offset, table.bytes]);
        size += table.bytes;
    }
    // allocate a dest buffer to write extracted subfont to
    const buf = Buffer.alloc(size);
    // encode header fields
    buf.writeInt32BE(header.signature, 0);
    buf.writeUInt16BE(header.numTables, 4);
    buf.writeUInt16BE(header.searchRange, 6);
    buf.writeUInt16BE(header.entrySelector, 8);
    buf.writeUInt16BE(header.rangeShift, 10);
    // encode each table & table record
    for (const [i, table] of header.tables.entries()) {
        // get the remapped offset for this table
        const [offset] = tableSpans[i]!;
        // encode table record
        buf.writeUInt32BE(table.tag, 12 + i * 16);
        buf.writeUInt32BE(table.checksum, 16 + i * 16);
        buf.writeUInt32BE(offset, 20 + i * 16);
        buf.writeUInt32BE(table.bytes, 24 + i * 16);
    }
    if (typeof file !== 'string') {
        const fontBuffer = await fetchFont(file);
        if (!fontBuffer) return null;
        for (const [offset, srcOffset, bytes] of tableSpans) {
            // read table bytes from file to the dest buffer
            fontBuffer.copy(buf, offset, srcOffset, srcOffset + bytes);
        }
        return buf;
    }
    let fd: fs.FileHandle | null = null;
    try {
        // open the ttc font file
        fd = await fs.open(file, 'r');
        // encode each table & table record
        for (const [offset, srcOffset, bytes] of tableSpans) {
            // read table bytes from file to the dest buffer
            for (let read = 0; read < bytes;) {
                const { bytesRead } = await fd.read(buf, offset + read, bytes - read, srcOffset + read);
                read += bytesRead;
                if (bytesRead === 0) break;
            }
        }
        return buf;
    } finally {
        await fd?.close();
    }
}

export function getFontBuffer({ src, ttcSubfont }: Pick<SystemFontData, 'src' | 'ttcSubfont'>) {
    if (ttcSubfont) {
        return extractTtcFont(src.file, ttcSubfont);
    }
    if (typeof src.file === 'string') {
        return fs.readFile(src.file);
    }
    return fetchFont(src.file);
}