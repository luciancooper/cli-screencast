import { deflateSync } from 'zlib';
import PNG, { PNGChunk, PNGEncoding } from '@src/image/png';
import pngFixtures from './fixtures/png.json';

const fixtures = (() => {
    const obj: Record<string, Buffer> = {};
    for (const [id, { data }] of Object.entries(pngFixtures)) {
        obj[id] = Buffer.from(data, 'base64');
    }
    return obj as Record<keyof typeof pngFixtures, Buffer>;
})();

function createPngBuffer(...chunks: readonly [string, number | Buffer][]): Buffer {
    return PNG.encodeChunks(chunks.map<PNGChunk>(([type, data]) => ({
        type,
        data: typeof data === 'number' ? Buffer.alloc(data) : type === 'IDAT' ? deflateSync(data) : data,
    })));
}

describe('PNG', () => {
    describe('color type & bit depth combinations', () => {
        test('color type 0 (greyscale) & bit depth 1', () => {
            const buffer = fixtures.basi0g01,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 0, bitDepth: 1 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 1 });
        });

        test('color type 0 (greyscale) & bit depth 2', () => {
            const buffer = fixtures.basi0g02,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 0, bitDepth: 2 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 2 });
        });

        test('color type 0 (greyscale) & bit depth 4', () => {
            const buffer = fixtures.basi0g04,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 0, bitDepth: 4 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 4 });
        });

        test('color type 0 (greyscale) & bit depth 8', () => {
            const buffer = fixtures.basi0g08,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 0, bitDepth: 8 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 8 });
        });

        test('color type 0 (greyscale) & bit depth 16', () => {
            const buffer = fixtures.basi0g16,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 0, bitDepth: 16 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 8 });
        });

        test('color type 2 (rgb) & bit depth 8', () => {
            const buffer = fixtures.basi2c08,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 2, bitDepth: 8 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 2, bitDepth: 8 });
        });

        test('color type 2 (rgb) & bit depth 16', () => {
            const buffer = fixtures.basi2c16,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 2, bitDepth: 16 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 2, bitDepth: 8 });
        });

        test('color type 3 (indexed) & bit depth 1 (2 colors)', () => {
            const buffer = fixtures.basi3p01,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 3, bitDepth: 1 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 1 });
        });

        test('color type 3 (indexed) & bit depth 2 (4 colors)', () => {
            const buffer = fixtures.basi3p02,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 3, bitDepth: 2 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 2 });
        });

        test('color type 3 (indexed) & bit depth 4 (16 colors)', () => {
            const buffer = fixtures.basi3p04,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 3, bitDepth: 4 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 4 });
        });

        test('color type 3 (indexed) & bit depth 8 (256 colors)', () => {
            const buffer = fixtures.basi3p08,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 3, bitDepth: 8 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 8 });
        });

        test('color type 3 (indexed) - content is a single pixel', () => {
            const buffer = fixtures.s01i3p01,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ interlaced: true })));
        });

        test('color type 4 (greyscale + alpha) & bit depth 8', () => {
            const buffer = fixtures.basi4a08,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 4, bitDepth: 8 })));
            // color count: 1024
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 4, bitDepth: 8 });
        });

        test('color type 4 (greyscale + alpha) & bit depth 16', () => {
            const buffer = fixtures.basi4a16,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 4, bitDepth: 16 })));
            // color count: 136
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 8 });
        });

        test('color type 6 (rgb + alpha) & bit depth 8', () => {
            const buffer = fixtures.basi6a08,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 6, bitDepth: 8 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 6, bitDepth: 8 });
        });

        test('color type 6 (rgb + alpha) & bit depth 16', () => {
            const buffer = fixtures.basi6a16,
                png = new PNG(buffer);
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(png.pack({ colorType: 6, bitDepth: 16 })));
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 6, bitDepth: 8 });
        });
    });

    describe('transparency', () => {
        test('color type 0 (greyscale) with tRNS chunk', () => {
            const buffer = fixtures.tbbn0g04,
                png = new PNG(buffer),
                chunks = png.packChunks({ colorType: 0, bitDepth: 4 });
            expect(chunks.map(({ type }) => type)).toContain('tRNS');
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(PNG.encodeChunks(chunks)));
            // color count: 16
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 4 });
        });

        test('color type 2 (rgb) with tRNS chunk', () => {
            const buffer = fixtures.tbrn2c08,
                png = new PNG(buffer),
                chunks = png.packChunks({ colorType: 2, bitDepth: 8 });
            expect(chunks.map(({ type }) => type)).toContain('tRNS');
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(PNG.encodeChunks(chunks)));
            // color count: 407
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 2, bitDepth: 8 });
        });

        test('color type 3 (indexed) with tRNS chunk', () => {
            const buffer = fixtures.tm3n3p02,
                png = new PNG(buffer),
                chunks = png.packChunks({ colorType: 3, bitDepth: 2 });
            expect(chunks.map(({ type }) => type)).toContain('tRNS');
            expect(PNG.decodePixels(buffer)).toEqual(PNG.decodePixels(PNG.encodeChunks(chunks)));
            // color count: 4
            expect(png.resolveEncoding()).toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 2 });
        });

        test('color type 6 (rgb + alpha) with invalid tRNS chunk', () => {
            const png = createPngBuffer(
                ['IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])],
                ['tRNS', 6],
                ['IDAT', Buffer.from([0, 0x99, 0xCC, 0xFF, 0x7F])],
                ['IEND', 0],
            );
            expect(() => new PNG(png)).toThrow('tRNS chunk not allowed for color type 6');
        });
    });

    describe('pixel dimensions', () => {
        test('parse pHYs chunk', () => {
            const png = new PNG(fixtures.cdun2c08);
            expect(png.density).not.toBeUndefined();
            expect(png.packChunks().map(({ type }) => type)).toContain('pHYs');
        });

        test('manually set pixel dimensions', () => {
            const png = new PNG({ width: 1, height: 1 }).setPixels(Buffer.from([0, 0, 0, 255]));
            // set pixel density
            png.setPixelDensity(144);
            expect(png.density).not.toBeUndefined();
            expect(png.packChunks().map(({ type }) => type)).toContain('pHYs');
        });
    });

    describe('text', () => {
        test('encode text chunks', () => {
            const png = new PNG({ width: 1, height: 1 }).setPixels(Buffer.from([0, 0, 0, 255]));
            // set text key-value pairs
            png.setText('title', 'empty png file');
            png.setText('label', 'png text metadata');
            expect(png.packChunks().map(({ type }) => type)).toEqual(expect.arrayContaining(['tEXt', 'tEXt']));
        });

        test('encode text as zTXt chunk when text is sufficiently long', () => {
            const png = new PNG({ width: 1, height: 1 }).setPixels(Buffer.from([0, 0, 0, 255]));
            // set text key-value pair
            png.setText('label', 'x'.repeat(1500));
            expect(png.packChunks().map(({ type }) => type)).toContain('zTXt');
        });
    });

    describe('packing', () => {
        test('resolveEncoding fixes invalid colorType and bitDepth combinations', () => {
            const png = new PNG({ width: 32, height: 32 });
            expect(png.resolveEncoding({ colorType: 3, bitDepth: 16 }))
                .toMatchObject<Partial<PNGEncoding>>({ colorType: 3, bitDepth: 8 });
            expect(png.resolveEncoding({ colorType: 6, bitDepth: 4 }))
                .toMatchObject<Partial<PNGEncoding>>({ colorType: 6, bitDepth: 8 });
        });

        test('throws error if png contains no pixel data', () => {
            const png = new PNG({ width: 32, height: 32 });
            expect(() => png.pack()).toThrow('png contains no pixel data');
        });

        test('throws error if png is animated and contains no frames', () => {
            const png = new PNG({ width: 32, height: 32 });
            png.animated = true;
            expect(() => png.pack()).toThrow('png contains no content frames');
        });

        test('throws error if pixel cannot be found in color palette', () => {
            const png = new PNG({ width: 1, height: 1 });
            png.pixels = deflateSync(Buffer.from([0, 0, 0, 255]));
            expect(() => png.pack({ colorType: 3 })).toThrow('Color [0, 0, 0, 255] is not in palette');
        });

        test('encodes acTL, fcTL, & fdAT chunks if png is animated', () => {
            const png = new PNG({ width: 32, height: 32 });
            png.addFrame(fixtures.basi3p01, 1000);
            png.addFrame(fixtures.basi3p02, 1000);
            const chunks = png.packChunks().map(({ type }) => type).filter((t) => /^(?:[af]cTL|IDAT|fdAT)$/.test(t));
            expect(chunks).toEqual(['acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT']);
        });
    });

    describe('corrupted data', () => {
        test('throw error when png header is invalid', () => {
            expect(() => new PNG(fixtures.xs7n0g01)).toThrow('Invalid .png file header');
        });

        test('throw error when IHDR header chunk is missing', () => {
            const png = createPngBuffer(['IDAT', 100], ['IEND', 0]);
            expect(() => new PNG(png)).toThrow('IHDR header missing');
        });

        test('throw error when IEND chunk is missing', () => {
            const png = createPngBuffer(['IHDR', 13], ['IDAT', 100]);
            expect(() => new PNG(png)).toThrow('.png file ended prematurely: no IEND header was found');
        });

        test('throw error when IDAT chunks are missing', () => {
            expect(() => new PNG(fixtures.xdtn0g01)).toThrow('Missing IDAT chunks');
        });

        test('throw error when crc chunks are corrupted', () => {
            expect(() => new PNG(fixtures.xhdn0g08))
                .toThrow('CRC values for IHDR header do not match, PNG file is likely corrupted');
        });

        test('throw error on invalid filter type', () => {
            const png = createPngBuffer(
                ['IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0, 0, 0])],
                ['IDAT', Buffer.from([5, 0])],
                ['IEND', 0],
            );
            expect(() => new PNG(png)).toThrow('Invalid filter type: 5');
        });
    });
});