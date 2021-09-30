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
    return (buf: Uint8Array, seed = 0) => {
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

const uint8 = new Uint8Array(4),
    int32 = new Int32Array(uint8.buffer),
    uint32 = new Uint32Array(uint8.buffer);

export interface PNGChunk {
    name: string
    data: Uint8Array
}

export const PNGHeader = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

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
        for (let x = 3; x >= 0; x -= 1, idx += 1) uint8[x] = png[idx]!;
        // Chunk includes name/type for CRC check (see below).
        const length = uint32[0]! + 4,
            chunk = new Uint8Array(length);
        for (let x = 0; x < 4; x += 1, idx += 1) chunk[x] = png[idx]!;
        // Get the name in ASCII for identification.
        const name = String.fromCharCode(chunk[0]!)
            + String.fromCharCode(chunk[1]!)
            + String.fromCharCode(chunk[2]!)
            + String.fromCharCode(chunk[3]!);
        // The IHDR header MUST come first.
        if (!chunks.length && name !== 'IHDR') {
            throw new Error('IHDR header missing');
        }
        // The IEND header marks the end of the file, so on discovering it break out of the loop.
        if (name === 'IEND') {
            ended = true;
            chunks.push({ name, data: new Uint8Array(0) });
            break;
        }
        // Read the contents of the chunk out of the main buffer.
        for (let i = 4; i < length; i += 1, idx += 1) chunk[i] = png[idx]!;
        // Read out the CRC value for comparison. It's stored as an Int32.
        for (let x = 3; x >= 0; x -= 1, idx += 1) uint8[x] = png[idx]!;

        const crcActual = int32[0],
            crcExpect = crc32_buf(chunk);
        if (crcExpect !== crcActual) {
            throw new Error(`CRC values for ${name} header do not match, PNG file is likely corrupted`);
        }
        // The chunk data is now copied to remove the 4 preceding bytes used for the chunk name/type.
        chunks.push({ name, data: new Uint8Array(chunk.buffer.slice(4)) });
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
    const output = new Uint8Array(totalSize);
    output.set(PNGHeader, 0);
    let idx = PNGHeader.length;
    for (const { name, data } of chunks) {
        const size = data.length;
        uint32[0] = size;
        for (let i = 3; i >= 0; i -= 1, idx += 1) {
            output[idx] = uint8[i]!;
        }
        for (let i = 0; i < 4; i += 1, idx += 1) {
            output[idx] = name.charCodeAt(i)!;
        }
        for (let j = 0; j < size; j += 1, idx += 1) {
            output[idx] = data[j]!;
        }
        const crcCheck = [0, 1, 2, 3].map((i) => name.charCodeAt(i)).concat(Array.prototype.slice.call(data)),
            crc = crc32_buf(Uint8Array.from(crcCheck));
        int32[0] = crc;
        for (let i = 3; i >= 0; i -= 1, idx += 1) {
            output[idx] = uint8[i]!;
        }
    }
    return Buffer.from(output);
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
    const phys = new Uint8Array(9);
    uint32[0] = Math.round(ppi / 0.0254);
    for (let i = 0; i < 4; i += 1) {
        phys[i] = uint8[3 - i]!;
        phys[i + 4] = uint8[3 - i]!;
    }
    phys[8] = 1;
    // extract chunks
    const chunks = extractPngChunks(png);
    // get index of current pHYs chunk
    let physIdx = chunks.findIndex(({ name }) => name === 'pHYs');
    if (physIdx < 0) {
        // insert 'pHYs' chunk before the first 'IDAT' chunk
        physIdx = chunks.findIndex(({ name }) => name === 'IDAT');
        chunks.splice(physIdx, 0, { name: 'pHYs', data: phys });
    } else {
        chunks[physIdx] = { name: 'pHYs', data: phys };
    }
    // join chunks
    return encodePngChunks(chunks);
}