import { extractPngChunks, setPixelDensity, PNGHeader, crc32_buf } from '@src/image/png';

const uint8 = new Uint8Array(4),
    int32 = new Int32Array(uint8.buffer),
    uint32 = new Uint32Array(uint8.buffer);

function createPngBuffer(...chunks: readonly [string, number][]): Buffer {
    const arrays = chunks.map(([name, size]) => {
            const chunk = new Uint8Array(size + 12);
            let idx = 0;
            // encode size
            uint32[0] = size;
            for (let i = 3; i >= 0; i -= 1, idx += 1) chunk[idx] = uint8[i]!;
            // encode name
            for (let i = 0; i < name.length; i += 1, idx += 1) {
                chunk[idx] = name.charCodeAt(i)!;
            }
            idx += size;
            // encode crc
            int32[0] = crc32_buf(chunk.slice(4, size + 8));
            for (let i = 3; i >= 0; i -= 1, idx += 1) chunk[idx] = uint8[i]!;
            return chunk;
        }),
        joined = new Uint8Array(arrays.reduce((acc, a) => acc + a.length, PNGHeader.length));
    joined.set(PNGHeader, 0);
    let idx = PNGHeader.length;
    for (const a of arrays) {
        joined.set(a, idx);
        idx += a.length;
    }
    return Buffer.from(joined);
}

describe('extractPngChunks', () => {
    test('throw error on invalid png header', () => {
        expect(() => {
            extractPngChunks(Buffer.from(Array(8).fill(0)));
        }).toThrow('Invalid .png file header');
    });

    test('throw error if IHDR header chunk is missing', () => {
        const png = createPngBuffer(['IDAT', 100], ['IEND', 0]);
        expect(() => {
            extractPngChunks(png);
        }).toThrow('IHDR header missing');
    });

    test('throw error if IEND chunk is missing', () => {
        const png = createPngBuffer(['IHDR', 13], ['IDAT', 100]);
        expect(() => {
            extractPngChunks(png);
        }).toThrow('.png file ended prematurely: no IEND header was found');
    });

    test('throw error if crc chunks are corrupted', () => {
        const png = createPngBuffer(['IHDR', 13]);
        // corrupt crc value
        png[png.length - 1] += 1;
        expect(() => {
            extractPngChunks(png);
        }).toThrow('CRC values for IHDR header do not match, PNG file is likely corrupted');
    });

    test('split chunks when png buffer is valid', () => {
        const chunks = extractPngChunks(createPngBuffer(['IHDR', 13], ['IDAT', 100], ['IEND', 0]));
        expect(chunks.map(({ name, data }) => ({ name, length: data.length }))).toEqual([
            { name: 'IHDR', length: 13 },
            { name: 'IDAT', length: 100 },
            { name: 'IEND', length: 0 },
        ]);
    });
});

describe('setPixelDensity', () => {
    test('inserts pHYs chunk if it does not exist in png data', () => {
        const png = setPixelDensity(createPngBuffer(['IHDR', 13], ['IDAT', 100], ['IEND', 0]), 72),
            chunks = extractPngChunks(png);
        expect(chunks.map(({ name }) => name)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    });

    test('replaces pHYs chunk if it does exist in png data', () => {
        const png = setPixelDensity(createPngBuffer(['IHDR', 13], ['pHYs', 9], ['IDAT', 100], ['IEND', 0]), 72),
            chunks = extractPngChunks(png);
        expect(chunks.map(({ name }) => name)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    });
});