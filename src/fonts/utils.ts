import type { URL } from 'url';
import { promises as fs } from 'fs';
import { decompress } from 'wawoff2';
import type { SystemFontData } from './types';
import { fetchData } from '../utils';
import log from '../logger';

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
 * Returns a font buffer for a single font. If the source font is in a font collection, it will be extracted.
 * Compressed woff2 fonts will be returned decompressed.
 */
export async function getFontBuffer({ src, ttcSubfont }: Pick<SystemFontData, 'src' | 'ttcSubfont'>) {
    if (!ttcSubfont) {
        // get font buffer from file or url
        let buffer = await ((typeof src.file === 'string') ? fs.readFile(src.file) : fetchFont(src.file));
        if (!buffer) return null;
        // decompress if src is woff2 data
        if (src.woff2) buffer = Buffer.from(await decompress(buffer));
        return buffer;
    }
    // extract subfont from a ttc font collection and encode it as a standalone font
    const tableSpans: [destOffset: number, srcOffset: number, bytes: number][] = [];
    // calculate byte length of subfont
    let size = 12 + ttcSubfont.tables.length * 16;
    for (const { offset, bytes } of ttcSubfont.tables) {
        tableSpans.push([size, offset, bytes]);
        // tables need to be properly aligned
        size += bytes + ((bytes % 4) ? (4 - (bytes % 4)) : 0);
    }
    // allocate a dest buffer to write extracted subfont to
    const buf = Buffer.alloc(size);
    // encode header fields
    buf.writeInt32BE(ttcSubfont.signature, 0);
    buf.writeUInt16BE(ttcSubfont.numTables, 4);
    buf.writeUInt16BE(ttcSubfont.searchRange, 6);
    buf.writeUInt16BE(ttcSubfont.entrySelector, 8);
    buf.writeUInt16BE(ttcSubfont.rangeShift, 10);
    // encode each table & table record
    for (const [i, table] of ttcSubfont.tables.entries()) {
        // get the remapped offset for this table
        const [offset] = tableSpans[i]!;
        // encode table record
        buf.writeUInt32BE(table.tag, 12 + i * 16);
        buf.writeUInt32BE(table.checksum, 16 + i * 16);
        buf.writeUInt32BE(offset, 20 + i * 16);
        buf.writeUInt32BE(table.bytes, 24 + i * 16);
    }
    // check if source is a local file that is not woff2 compressed
    if (typeof src.file === 'string' && !src.woff2) {
        // copy table data with selective reads from the underlying file.
        let fd: fs.FileHandle | null = null;
        try {
            // open the ttc font file
            fd = await fs.open(src.file, 'r');
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
    // else read entire font buffer into memory
    let fontBuffer = await ((typeof src.file === 'string') ? fs.readFile(src.file) : fetchFont(src.file));
    if (!fontBuffer) return null;
    // decompress if src is woff2 data
    if (src.woff2) fontBuffer = Buffer.from(await decompress(fontBuffer));
    // copy tables from the source data
    for (const [offset, srcOffset, bytes] of tableSpans) {
        // read table bytes from file to the dest buffer
        fontBuffer.copy(buf, offset, srcOffset, srcOffset + bytes);
    }
    return buf;
}