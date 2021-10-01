import { extractPngChunks, setPixelDensity, PNGHeader, crc32_buf } from '@src/image/png';

function createPngBuffer(...chunks: readonly [string, number][]): Buffer {
    return Buffer.concat([PNGHeader, ...chunks.map(([type, size]) => {
        const chunk = Buffer.alloc(size + 12);
        // encode chunk size
        chunk.writeUInt32BE(size, 0);
        // encode chunk name
        chunk.write(type, 4, 4);
        // encode crc
        const crc = crc32_buf(chunk.slice(4, 8 + size));
        chunk.writeInt32BE(crc, 8 + size);
        return chunk;
    })]);
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
        expect(chunks.map(({ type, data }) => ({ type, length: data.length }))).toEqual([
            { type: 'IHDR', length: 13 },
            { type: 'IDAT', length: 100 },
            { type: 'IEND', length: 0 },
        ]);
    });
});

describe('setPixelDensity', () => {
    test('inserts pHYs chunk if it does not exist in png data', () => {
        const png = setPixelDensity(createPngBuffer(['IHDR', 13], ['IDAT', 100], ['IEND', 0]), 72),
            chunks = extractPngChunks(png);
        expect(chunks.map(({ type }) => type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    });

    test('replaces pHYs chunk if it does exist in png data', () => {
        const png = setPixelDensity(createPngBuffer(['IHDR', 13], ['pHYs', 9], ['IDAT', 100], ['IEND', 0]), 72),
            chunks = extractPngChunks(png);
        expect(chunks.map(({ type }) => type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    });
});