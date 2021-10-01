/**
 * Adapted from {@link https://github.com/SheetJS/js-crc32}
 */
export const crc32_buf = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let i = 0; i < 8; i += 1) c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        table[n] = c;
    }
    return (buf: ArrayLike<number>, seed = 0) => {
        const n = buf.length > 10000 ? 8 : 4;
        let C = seed ^ -1;
        const L = buf.length - (n - 1);
        let i = 0;
        for (; i < L;) {
            for (let x = 0; x < n; x += 1, i += 1) {
                C = (C >>> 8) ^ table[(C ^ buf[i]!) & 0xFF]!;
            }
        }
        for (; i < L + (n - 1); i += 1) {
            C = (C >>> 8) ^ table[(C ^ buf[i]!) & 0xFF]!;
        }
        return C ^ -1;
    };
})();

export interface PNGChunk {
    type: string
    data: Buffer
}

export const PNGHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/**
 * Adapted from {@link https://github.com/hughsk/png-chunks-extract}
 */
export function extractPngChunks(png: Buffer): PNGChunk[] {
    if (PNGHeader.some((bit, i) => png[i] !== bit)) {
        throw new Error('Invalid .png file header');
    }
    const chunks: PNGChunk[] = [];
    let [idx, ended] = [8, false];
    while (idx < png.length) {
        // Read the length of the current chunk, which is stored as a Uint32.
        const size = png.readUInt32BE(idx),
            // Get the name in ASCII for identification.
            type = String.fromCharCode(...png.slice(idx += 4, idx += 4)),
            // Read the contents of the chunk out of the main buffer.
            data = png.subarray(idx, idx += size);
        // calculate the expected CRC value and compare it to the encoded CRC value
        if (crc32_buf(png.slice(idx - size - 4, idx)) !== png.readInt32BE(idx)) {
            throw new Error(`CRC values for ${type} header do not match, PNG file is likely corrupted`);
        }
        idx += 4;
        // The IHDR header MUST come first.
        if (!chunks.length && type !== 'IHDR') {
            throw new Error('IHDR header missing');
        }
        // add this chunk
        chunks.push({ type, data });
        // The IEND header marks the end of the file, so on discovering it break out of the loop.
        if (type === 'IEND') {
            ended = true;
            break;
        }
    }
    if (!ended) {
        throw new Error('.png file ended prematurely: no IEND header was found');
    }
    return chunks;
}

/**
 * Adapted from {@link https://github.com/hughsk/png-chunks-encode}
 */
export function encodePngChunks(chunks: PNGChunk[]): Buffer {
    let totalSize = 8;
    for (const { data } of chunks) {
        totalSize += data.length + 12;
    }
    const png = Buffer.alloc(totalSize);
    png.set(PNGHeader, 0);
    let idx = PNGHeader.length;
    for (const { type, data } of chunks) {
        const size = data.length;
        // encode chunk size
        idx = png.writeUInt32BE(size, idx);
        // encode chunk name
        idx += png.write(type, idx, 4);
        // encode chunk data
        png.set(data, idx);
        // encode crc value
        const crc = crc32_buf(png.slice(idx - 4, idx + size));
        idx = png.writeInt32BE(crc, idx + size);
    }
    return png;
}

/**
 * Encode a `pHYs` chunk into a png data buffer to specify intended pixel density
 * @see {@link http://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.pHYs|PNG Specification}
 * @param png - png data buffer
 * @param ppi - number of pixels per inch
 * @returns modified png data buffer with a `pHYs` chunk
 */
export function setPixelDensity(png: Buffer, ppi: number) {
    // create pHYs chunk data
    const phys = Buffer.alloc(9),
        // convert from pixels per inch to pixels per meter
        ppm = Math.round(ppi / 0.0254);
    // write ppm
    phys.writeUInt32BE(ppm, 0);
    phys.writeUInt32BE(ppm, 4);
    phys[8] = 1;
    // create pHYs chunk object
    const physChunk = { type: 'pHYs', data: phys },
        // extract chunks
        chunks = extractPngChunks(png);
    // get index of current pHYs chunk
    let physIdx = chunks.findIndex(({ type }) => type === 'pHYs');
    if (physIdx < 0) {
        // insert 'pHYs' chunk before the first 'IDAT' chunk
        physIdx = chunks.findIndex(({ type }) => type === 'IDAT');
        chunks.splice(physIdx, 0, physChunk);
    } else {
        chunks[physIdx] = physChunk;
    }
    // join chunks
    return encodePngChunks(chunks);
}