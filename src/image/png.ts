import { inflateSync, deflateSync } from 'zlib';
import { Size } from '../types';

export interface PNGChunk {
    type: string
    data: Buffer
}

type ColorType = 0 | 2 | 3 | 4 | 6;

type BitDepth = 1 | 2 | 4 | 8 | 16;

export interface PNGEncoding {
    bitDepth: BitDepth
    colorType: ColorType
    interlaced: boolean
}

interface PixelDensity {
    x: number
    y: number
    unit: 0 | 1
}

interface Coordinates {
    x: number
    y: number
}

interface PNGAnimationFrame {
    size: Size
    pixels: Buffer
    coordinates: Coordinates
    duration: number
    dispose: 0 | 1 | 2
    blend: 0 | 1
}

type Transparency = readonly [number, number, number];

interface PNGData {
    width: number
    height: number
    pixels: Buffer
}

/**
 * Adapted from {@link https://github.com/SheetJS/js-crc32}
 */
const crc32 = (() => {
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

function paeth(a: number, b: number, c: number): number {
    const pa = Math.abs(b - c),
        pb = Math.abs(a - c),
        pc = Math.abs(a + b - 2 * c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc) ? b : c;
}

function getPasses(interlaced: boolean): (readonly [number, number, number, number])[] {
    return interlaced ? [
        [0, 0, 8, 8], // 1
        [4, 0, 8, 8], // 2
        [0, 4, 4, 8], // 3
        [2, 0, 4, 4], // 4
        [0, 2, 2, 4], // 5
        [1, 0, 2, 2], // 6
        [0, 1, 1, 2], // 7
    ] : [[0, 0, 1, 1]];
}

const validBitDepths: Record<ColorType, BitDepth[]> = {
    0: [1, 2, 4, 8, 16] as BitDepth[], // grayscale
    2: [8, 16] as BitDepth[], // rgb
    3: [1, 2, 4, 8] as BitDepth[], // indexed
    4: [8, 16] as BitDepth[], // greyscale + alpha
    6: [8, 16] as BitDepth[], // rgb + alpha
} as const;

function rescaleSample(value: number, depthIn: number, depthOut: number) {
    if (depthIn === depthOut) return value;
    const maxSampleIn = (2 ** depthIn) - 1,
        maxSampleOut = (2 ** depthOut) - 1;
    return Math.round((value * maxSampleOut) / maxSampleIn);
}

export default class PNG {
    static Header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    ['constructor']: typeof PNG;

    size: Size;

    pixels?: Buffer;

    frames: PNGAnimationFrame[] = [];

    colors: number[] = [];

    gamma?: number;

    density?: PixelDensity;

    text: Record<string, string> = {};

    constructor(buffer?: Buffer) {
        if (!buffer) {
            this.size = { width: NaN, height: NaN };
            return;
        }
        const chunks = PNG.decodeChunks(buffer),
            { pixels, ...size } = PNG.decodePixels(chunks);
        this.size = size;
        this.addPixelColors(pixels);
        this.pixels = pixels;
        // decode `pHYs`
        const pHYs = chunks.find(({ type }) => type === 'pHYs')?.data ?? null;
        if (pHYs) this.density = { x: pHYs.readUInt32BE(0), y: pHYs.readUInt32BE(4), unit: pHYs[8]! as 0 | 1 };
        // decode `gAMA`
        const gAMA = chunks.find(({ type }) => type === 'gAMA')?.data ?? null;
        if (gAMA) this.gamma = gAMA.readUInt32BE() / 1e5;
    }

    static decodeChunks(png: Buffer): PNGChunk[] {
        if (this.Header.some((bit, i) => png[i] !== bit)) {
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
            if (crc32(png.slice(idx - size - 4, idx)) !== png.readInt32BE(idx)) {
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

    static decodePixels(png: PNGChunk[] | Buffer): PNGData {
        const chunks = Buffer.isBuffer(png) ? this.decodeChunks(png) : png,
            // first chunk must be `IHDR` chunk
            { data: header } = chunks[0]!,
            // get metadata from header chunk
            width = header.readUInt32BE(0),
            height = header.readUInt32BE(4),
            bitDepth = header[8]! as BitDepth,
            colorType = header[9]! as ColorType,
            interlaced = !!header[12]!,
            channelsPerPixel = ((colorType & 3) === 2 ? 3 : 1) + (colorType >>> 2),
            bitPerPixel = channelsPerPixel * bitDepth,
            pixelBytes = bitPerPixel >> 3 || 1;
        // decode `PLTE` & `tRNS`
        let palette: Buffer | undefined,
            transparency: Transparency | undefined;
        {
            const tRNS = chunks.find(({ type }) => type === 'tRNS')?.data ?? null;
            if (colorType === 3) {
                const plte = chunks.find(({ type }) => type === 'PLTE')!.data;
                palette = Buffer.alloc((plte.length / 3) * 4);
                for (let i = 0, n = palette.length, p = 0, t = 0; i < n; i += 1, t += 1) {
                    for (let x = 0; x < 3; x += 1, i += 1, p += 1) palette[i] = plte[p]!;
                    palette[i] = tRNS?.[t] ?? 0xFF;
                }
            } else if (tRNS) {
                if (colorType === 0) {
                    const v = rescaleSample(tRNS.readUInt16BE(0), bitDepth, 8);
                    transparency = [v, v, v];
                } else if (colorType === 2) {
                    transparency = [0, 2, 4].map((i) => (
                        rescaleSample(tRNS.readUInt16BE(i), bitDepth, 8)
                    )) as unknown as Transparency;
                } else {
                    throw new Error(`tRNS chunk not allowed for color type ${colorType}`);
                }
            }
        }
        // decode `IDAT` data
        const idat = chunks.filter(({ type }) => type === 'IDAT').map(({ data: d }) => d);
        if (!idat.length) {
            throw new Error('Missing IDAT chunks');
        }
        const data = inflateSync(Buffer.concat(idat)),
            pixels = Buffer.alloc(width * height * 4);
        let pos = 0;
        for (const [cx, cy, dx, dy] of getPasses(interlaced)) {
            const [w, h] = [Math.ceil((width - cx) / dx), Math.ceil((height - cy) / dy)];
            if (!w || !h) continue;
            const scanline = ((w * bitPerPixel + 7) >> 3),
                prevLine = Buffer.alloc(scanline),
                current = Buffer.alloc(scanline);
            for (let i = 0; i < h; i += 1) {
                const filter = data[pos]!,
                    filtered = data.slice(pos += 1, pos += scanline);
                current.fill(0);
                switch (filter) {
                    case 0: // None
                        current.set(filtered, 0);
                        break;
                    case 1: // Sub
                        for (let j = 0; j < scanline; j += 1) {
                            current[j] = filtered[j]! + (current[j - pixelBytes] ?? 0);
                        }
                        break;
                    case 2: // Up
                        for (let j = 0; j < scanline; j += 1) {
                            current[j] = filtered[j]! + prevLine[j]!;
                        }
                        break;
                    case 3: // Avg
                        for (let j = 0; j < scanline; j += 1) {
                            current[j] = filtered[j]! + (((current[j - pixelBytes] ?? 0) + prevLine[j]!) >> 1);
                        }
                        break;
                    case 4: // Paeth
                        for (let j = 0; j < scanline; j += 1) {
                            const a = current[j - pixelBytes] ?? 0,
                                b = prevLine[j]!,
                                c = prevLine[j - pixelBytes] ?? 0;
                            current[j] = filtered[j]! + paeth(a, b, c);
                        }
                        break;
                    default:
                        throw new Error(`Invalid filter type: ${filter}`);
                }
                prevLine.set(current);
                // map scan line to channels
                let channels: Buffer | Uint8Array | Uint16Array = current;
                if (bitDepth < 8) {
                    channels = new Uint8Array(scanline * 8 / bitDepth);
                    for (const [j, v] of current.entries()) {
                        for (let d = 8 / bitDepth - 1, c = j * (8 / bitDepth); d >= 0; d -= 1, c += 1) {
                            channels[c] = (v >> (d * bitDepth)) & ((1 << bitDepth) - 1);
                        }
                    }
                } else if (bitDepth === 16) {
                    channels = new Uint16Array(scanline >> 1);
                    for (let j = 0; j < channels.length; j += 1) {
                        channels[j] = current.readUInt16BE(j * 2);
                    }
                }
                // rescale samples if necessary
                if (colorType !== 3) channels = channels.map((v) => rescaleSample(v, bitDepth, 8));
                // map channels to pixel buffer
                let pidx = ((cy + i * dy) * width + cx) * 4;
                for (let j = 0, k = 0; j < w; j += 1, pidx += dx * 4, k += channelsPerPixel) {
                    if (colorType === 3) {
                        const idx = channels[k]! * 4;
                        pixels.set(palette!.subarray(idx, idx + 4), pidx);
                    } else if (colorType === 0 || colorType === 4) {
                        pixels.fill(channels[k]!, pidx, pidx + 3);
                        pixels[pidx + 3] = (colorType >>> 2) ? channels[k + 1]!
                            : transparency?.[0] === channels[k]! ? 0 : 0xFF;
                    } else {
                        pixels[pidx] = channels[k]!;
                        pixels[pidx + 1] = channels[k + 1]!;
                        pixels[pidx + 2] = channels[k + 2]!;
                        pixels[pidx + 3] = (colorType >>> 2) ? channels[k + 3]!
                            : transparency?.every((v, t) => channels[k + t] === v) ? 0 : 0xFF;
                    }
                }
            }
        }
        return { width, height, pixels } as const;
    }

    static encodeChunks(chunks: PNGChunk[]): Buffer {
        // get total size of all chunks
        let totalSize = 8;
        for (const { data } of chunks) {
            totalSize += data.length + 12;
        }
        const png = Buffer.alloc(totalSize);
        // encode png header
        png.set(this.Header, 0);
        let idx = this.Header.length;
        // encode each chunk
        for (const chunk of chunks) {
            const size = chunk.data.length;
            // encode chunk size
            idx = png.writeUInt32BE(size, idx);
            // encode chunk name
            idx += png.write(chunk.type, idx, 4);
            // encode chunk data
            png.set(chunk.data, idx);
            // encode crc value
            const crc = crc32(png.slice(idx - 4, idx + size));
            idx = png.writeInt32BE(crc, idx + size);
        }
        return png;
    }

    get width(): number {
        return this.size.width;
    }

    get height(): number {
        return this.size.height;
    }

    /**
     * Encode a `pHYs` chunk into a png data buffer to specify intended pixel density
     * @see {@link http://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.pHYs|PNG Specification}
     * @param ppi - number of pixels per inch
     */
    setPixelDensity(ppi: number): this {
        const ppm = Math.round(ppi / 0.0254);
        this.density = {
            x: ppm,
            y: ppm,
            unit: 1,
        };
        return this;
    }

    setText(key: string, value: string): this {
        this.text[key] = value;
        return this;
    }

    addFrame(data: Buffer, duration: number): this {
        const { pixels, width, height } = this.constructor.decodePixels(data);
        if (!this.frames.length) {
            this.size = { width, height };
            // set initial pixel buffer
            this.pixels = pixels;
            // add pixel colors from initial frame
            this.addPixelColors(pixels);
            // add initial frame
            this.frames.push({
                size: { width, height },
                pixels: deflateSync(pixels),
                coordinates: { x: 0, y: 0 },
                duration,
                dispose: 0,
                blend: 0,
            });
            return this;
        }
        // overlay new frame on current pixel buffer
        const buffer = this.pixels!,
            bufferWidth = this.size.width,
            // determine transparent pixel value
            transparent = (this.colors.length && (this.colors[0]! >>> 24) === 0)
                ? [this.colors[0]! & 0xFF, (this.colors[0]! >>> 8) & 0xFF, this.colors[0]! >>> 16, 0]
                : [0, 0, 0, 0],
            // create a map to track pixel overlay diff
            diff = Buffer.alloc(width * height);
        for (let i = 0; i < height; i += 1) {
            for (let j = 0; j < width; j += 1) {
                const [px, bx] = [i * width + j, i * bufferWidth + j],
                    prev = this.pixelColor(buffer, bx * 4),
                    next = this.pixelColor(pixels, px * 4);
                if (prev !== next) {
                    // pixel color has changed, update buffer
                    buffer.set(pixels.subarray(px * 4, (px + 1) * 4), bx * 4);
                    diff[px] = 1;
                } else {
                    // pixel color has not changed
                    pixels.set(transparent, px * 4);
                }
            }
        }
        // check if there is no difference between this frame and the last
        if (!diff.includes(1)) {
            // add duration of this frame to the previous one
            this.frames[this.frames.length - 1]!.duration += duration;
            return this;
        }
        // calculate crop insets
        const [y1, y2] = [Math.floor(diff.indexOf(1) / width), Math.floor(diff.lastIndexOf(1) / width)];
        let [x1, x2] = [width - 1, 0];
        for (let y = y1; y <= y2; y += 1) {
            const row = diff.subarray(y * width, (y + 1) * width),
                idx = row.indexOf(1);
            if (idx >= 0) {
                [x1, x2] = [Math.min(idx, x1), Math.max(row.lastIndexOf(1), x2)];
            }
        }
        // size of the cropped frame
        const [w, h] = [x2 - x1 + 1, y2 - y1 + 1];
        // create cropped pixel buffer
        let croppedPixels = pixels;
        if (w !== width || h !== height) {
            croppedPixels = Buffer.alloc(w * h * 4);
            for (let y = y1; y <= y2; y += 1) {
                const row = pixels.subarray((y * width + x1) * 4, (y * width + x2 + 1) * 4);
                croppedPixels.set(row, (y - y1) * w * 4);
            }
        }
        // add colors from cropped pixel buffer to palette
        this.addPixelColors(croppedPixels);
        // add cropped frame
        this.frames.push({
            size: { width: w, height: h },
            pixels: deflateSync(croppedPixels),
            coordinates: { x: x1, y: y1 },
            duration,
            dispose: 0,
            blend: 1,
        });
        return this;
    }

    private pixelColor(pixels: Buffer, idx: number) {
        return (pixels[idx]! | (pixels[idx + 1]! << 8) | (pixels[idx + 2]! << 16) | (pixels[idx + 3]! << 24)) >>> 0;
    }

    private addColor(color: number) {
        let l = 0;
        for (let r = this.colors.length, m = (l + r) >> 1; l < r; m = (l + r) >> 1) {
            const z = this.colors[m]!;
            if (color === z) return;
            if (color < z) r = m;
            else l = m + 1;
        }
        this.colors.splice(l, 0, color);
    }

    private addPixelColors(pixels: Buffer) {
        for (let i = 0, n = pixels.length; i < n; i += 4) {
            this.addColor(this.pixelColor(pixels, i));
        }
    }

    private getColorIndex(color: number) {
        for (let l = 0, r = this.colors.length, m = (l + r) >> 1; l < r; m = (l + r) >> 1) {
            const z = this.colors[m]!;
            if (color === z) return m;
            if (color < z) r = m;
            else l = m + 1;
        }
        throw new Error(`Color [${color & 0xFF}, ${(color >>> 8) & 0xFF}, ${(color >>> 16) & 0xFF}, ${color >>> 24}] is not in palette`);
    }

    resolveEncoding(enc: Partial<PNGEncoding> = {}): PNGEncoding {
        let { colorType, bitDepth, interlaced = false } = enc;
        const colorCount = this.colors.length;
        // determine color type
        if (typeof colorType !== 'number') {
            if (colorCount > 256) {
                // find index of first opaque color
                const opaque = this.colors.findIndex((c) => (c >>> 24) === 0xFF),
                    // number of colors whose alpha channel is not 255
                    transparent = opaque < 0 ? colorCount : opaque,
                    // determine if png needs alpha channel
                    alphaChannel = (transparent > 1 || (transparent === 1 && (this.colors[0]! >>> 24) !== 0)),
                    // determine if all colors are grey
                    greyscale = this.colors.every((px) => (
                        (px & 0xFF) === ((px >>> 8) & 0xFF) && (px & 0xFF) === ((px >>> 16) & 0xFF)
                    ));
                // return color type
                colorType = ((greyscale ? 0 : 2) + (alphaChannel ? 4 : 0)) as ColorType;
            } else {
                colorType = 3;
            }
        }
        // determine bit depth
        if (typeof bitDepth !== 'number') {
            bitDepth = colorType === 3 ? [1, 2, 4, 8].find((d) => colorCount <= (1 << d))! as BitDepth : 8;
        }
        // if bit depth is invalid, revert to the standard 8
        if (!validBitDepths[colorType].includes(bitDepth)) bitDepth = 8;
        // return resolved encoding
        return { colorType, bitDepth, interlaced };
    }

    protected encodePixels(
        pixels: Buffer,
        { width, height }: Size,
        { colorType, bitDepth, interlaced }: PNGEncoding,
    ): Buffer {
        const channelsPerPixel = ((colorType & 3) === 2 ? 3 : 1) + (colorType >>> 2),
            bitPerPixel = channelsPerPixel * bitDepth,
            pixelBytes = bitPerPixel >> 3 || 1,
            passes: Buffer[] = [];
        for (const [cx, cy, dx, dy] of getPasses(interlaced)) {
            const [w, h] = [Math.ceil((width - cx) / dx), Math.ceil((height - cy) / dy)];
            if (!w || !h) continue;
            const scanline = ((w * bitPerPixel + 7) >> 3),
                passBuffer = Buffer.alloc((scanline + 1) * h),
                prevLine = Buffer.alloc(scanline),
                current = Buffer.alloc(scanline),
                filterMatrix = Buffer.alloc(scanline * 5);
            for (let i = 0; i < h; i += 1) {
                let channels: number[] = [];
                for (let j = 0; j < w; j += 1) {
                    const pidx = ((cy + i * dy) * width + cx + j * dx) * 4;
                    if (colorType === 0) {
                        // greyscale
                        channels.push(pixels[pidx]!);
                    } else if (colorType === 2) {
                        // rgb
                        channels.push(...pixels.slice(pidx, pidx + 3));
                    } else if (colorType === 3) {
                        // indexed
                        channels.push(this.getColorIndex(this.pixelColor(pixels, pidx)));
                    } else if (colorType === 4) {
                        // greyscale + alpha
                        channels.push((pixels[pidx]! + pixels[pidx + 1]! + pixels[pidx + 2]!) / 3, pixels[pidx + 3]!);
                    } else {
                        // rgb + alpha
                        channels.push(...pixels.slice(pidx, pidx + 4));
                    }
                }
                // rescale samples if necessary
                if (colorType !== 3) channels = channels.map((v) => rescaleSample(v, 8, bitDepth));
                // channels to unfiltered line
                current.fill(0);
                if (bitDepth < 8) {
                    for (let j = 0; j < scanline; j += 1) {
                        let value = 0;
                        for (let k = (8 / bitDepth) - 1, c = j * (8 / bitDepth); k >= 0; k -= 1, c += 1) {
                            value |= (channels[c]! & ((1 << bitDepth) - 1)) << (k * bitDepth);
                        }
                        current[j] = value;
                    }
                } else if (bitDepth === 16) {
                    for (let j = 0; j < channels.length; j += 1) {
                        current.writeUInt16BE(channels[j]!, j * 2);
                    }
                } else current.set(channels, 0);
                // filter scan line
                let filter: number,
                    filtered: Buffer;
                // use adaptive filtering if using a greyscale or rgb color type
                if (colorType !== 3 && bitDepth >= 8) {
                    filterMatrix.fill(0);
                    // create array to track output byte sums
                    const sums = [0, 0, 0, 0, 0];
                    for (let j = 0; j < scanline; j += 1) {
                        const v = current[j]!,
                            a = current[j - pixelBytes] ?? 0,
                            b = prevLine[j]!,
                            c = prevLine[j - pixelBytes] ?? 0;
                        for (const [k, f] of [v, v - a, v - b, v - ((a + b) >> 1), v - paeth(a, b, c)].entries()) {
                            filterMatrix[k * scanline + j] = f;
                            sums[k] += Math.abs(f);
                        }
                    }
                    // determine which filter has min sum
                    const minSum = Math.min(...sums);
                    filter = sums.findIndex((v) => v === minSum);
                    filtered = filterMatrix.subarray(filter * scanline, (filter + 1) * scanline);
                } else {
                    filter = 0;
                    filtered = current;
                }
                // add filtered line to pass buffer
                passBuffer[i * (scanline + 1)] = filter;
                passBuffer.set(filtered, i * (scanline + 1) + 1);
                // set previous unfiltered line for next iteration
                prevLine.set(current);
            }
            passes.push(passBuffer);
        }
        return deflateSync(Buffer.concat(passes));
    }

    packChunks(enc: Partial<PNGEncoding> = {}): PNGChunk[] {
        const chunks: PNGChunk[] = [],
            { colorType, bitDepth, interlaced } = this.resolveEncoding(enc);
        // encode 'IHDR' chunk
        {
            const IHDR = Buffer.alloc(13);
            IHDR.writeUInt32BE(this.width, 0);
            IHDR.writeUInt32BE(this.height, 4);
            IHDR[8] = bitDepth;
            IHDR[9] = colorType;
            IHDR[12] = interlaced ? 1 : 0;
            chunks.push({ type: 'IHDR', data: IHDR });
        }
        // encode 'acTL' chunk if animated
        if (this.frames.length > 0) {
            const acTL = Buffer.alloc(8);
            acTL.writeUInt32BE(this.frames.length, 0);
            // insert after header chunk
            chunks.push({ type: 'acTL', data: acTL });
        }
        // encode 'pHYs' chunk
        if (this.density) {
            const pHYs = Buffer.alloc(9);
            pHYs.writeUInt32BE(this.density.x);
            pHYs.writeUInt32BE(this.density.y, 4);
            pHYs[8] = this.density.unit;
            chunks.push({ type: 'pHYs', data: pHYs });
        }
        // encode 'gAMA' chunk
        if (typeof this.gamma === 'number') {
            const gAMA = Buffer.alloc(4);
            gAMA.writeUInt32BE(this.gamma * 100000, 0);
            chunks.push({ type: 'gAMA', data: gAMA });
        }
        // encode 'PLTE' & 'tRNS'
        const { colors } = this;
        if (colorType === 3) {
            // pack 'PLTE'
            const PLTE = Buffer.alloc(colors.length * 3);
            for (const [i, color] of colors.entries()) {
                for (let x = 0; x < 3; x += 1) PLTE[i * 3 + x] = (color >>> x * 8) & 0xFF;
            }
            chunks.push({ type: 'PLTE', data: PLTE });
            // pack 'tRNS'
            const opaque = colors.findIndex((c) => (c >>> 24) === 0xFF);
            if (opaque) {
                const tRNS = Buffer.from((opaque < 0 ? colors : colors.slice(0, opaque)).map((c) => c >>> 24));
                chunks.push({ type: 'tRNS', data: tRNS });
            }
        } else if ((colorType === 0 || colorType === 2) && colors.length && (colors[0]! >>> 24) === 0) {
            // pack 'tRNS'
            const tRNS = Buffer.alloc((colorType + 1) * 2);
            for (let x = 0; x <= colorType; x += 1) {
                tRNS.writeUInt16BE(rescaleSample((colors[0]! >>> x * 8) & 0xFF, 8, bitDepth), x * 2);
            }
            chunks.push({ type: 'tRNS', data: tRNS });
        }
        // encode 'tEXt' & 'zTXt' chunks
        const endTextChunks: PNGChunk[] = [];
        for (const [key, data] of Object.entries(this.text)) {
            const keyBytes = Math.min(key.length, 79),
                byteSize = keyBytes + 1 + data.length;
            // only use zTXt compressed chunk if byte length >= 1024
            // see http://www.libpng.org/pub/png/spec/1.2/PNG-Encoders.html#E.Text-chunk-processing
            if (byteSize >= 1024) {
                const text = Buffer.alloc(data.length);
                text.write(data, 0, data.length);
                const compressedText = deflateSync(text),
                    zTXt = Buffer.alloc(keyBytes + 2 + compressedText.length);
                zTXt.write(key, 0, keyBytes);
                zTXt.set(compressedText, keyBytes + 2);
                endTextChunks.push({ type: 'zTXt', data: zTXt });
            } else {
                const tEXt = Buffer.alloc(byteSize);
                tEXt.write(key, 0, keyBytes);
                tEXt.write(data, keyBytes + 1);
                (['title', 'author', 'software'].includes(key.toLowerCase()) ? chunks : endTextChunks).push(
                    { type: 'tEXt', data: tEXt },
                );
            }
        }
        // pack content chunks
        if (this.frames.length > 0) {
            // track sequence index encoded into the first 4 bits of every `fcTL` & `fdAT` chunk
            let seqIndex = 0;
            // pack 'fcTL' + 'IDAT' + ['fcTL', 'fdAT', ...] ...
            for (const [idx, { pixels, size, ...frame }] of this.frames.entries()) {
                // pack 'fcTL' for this frame
                const fcTL = Buffer.alloc(26);
                fcTL.writeUInt32BE(seqIndex, 0);
                fcTL.writeUInt32BE(size.width, 4);
                fcTL.writeUInt32BE(size.height, 8);
                fcTL.writeUInt32BE(frame.coordinates.x, 12);
                fcTL.writeUInt32BE(frame.coordinates.y, 16);
                fcTL.writeUInt16BE(frame.duration % 60000, 20);
                fcTL.writeUInt16BE(1000, 22);
                fcTL[24] = frame.dispose;
                fcTL[25] = frame.blend;
                chunks.push({ type: 'fcTL', data: fcTL });
                // increment sequence index
                seqIndex += 1;
                // encode pixel data
                const encoded = this.encodePixels(inflateSync(pixels), size, { colorType, bitDepth, interlaced });
                for (let i = 0, n = encoded.length, c = idx ? 8188 : 8192; i < n; i += c) {
                    const len = Math.min(c, n - i);
                    if (!idx) {
                        // add 'IDAT' chunk
                        chunks.push({ type: 'IDAT', data: encoded.slice(i, i + c) });
                        continue;
                    }
                    // determine size of this chunk
                    const buffer = Buffer.alloc(len + 4);
                    // write sequence index into first 4 bits
                    buffer.writeUInt32BE(seqIndex, 0);
                    // write compressed pixel data into remaining chunk space
                    buffer.set(encoded.subarray(i, i + len), 4);
                    // add `fdAT` chunk
                    chunks.push({ type: 'fdAT', data: buffer });
                    // increment sequence index
                    seqIndex += 1;
                }
            }
        } else if (this.pixels) {
            // encode 'IDAT' chunks
            const encoded = this.encodePixels(this.pixels, this.size, { colorType, bitDepth, interlaced });
            for (let i = 0, n = encoded.length; i < n; i += 8192) {
                chunks.push({ type: 'IDAT', data: encoded.slice(i, i + Math.min(8192, n - i)) });
            }
        } else {
            throw new Error('png contains no pixel data');
        }
        // add large text chunks
        chunks.push(...endTextChunks);
        // add 'IEND' chunk
        chunks.push({ type: 'IEND', data: Buffer.alloc(0) });
        return chunks;
    }

    pack(enc?: Partial<PNGEncoding>): Buffer {
        const chunks = this.packChunks(enc);
        return this.constructor.encodeChunks(chunks);
    }
}