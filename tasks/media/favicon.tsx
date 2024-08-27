import { renderToStaticMarkup } from 'react-dom/server';
import PNG from '@src/image/png';
import { createPng } from '@src/image';
import { writeToFile } from '@src/utils';
import log from '@src/logger';
import { ProjectLogo } from './project-logo';

async function createFavicon(svg: string, sizes: number[]): Promise<Buffer> {
    const pngs: ReturnType<typeof PNG.decodePixels>[] = [],
        n = sizes.length;
    for (const size of sizes) {
        const png = await createPng({ svg, width: size, height: size }, 1);
        pngs.push(PNG.decodePixels(png));
    }
    // allocate buffer for ico
    const buf = Buffer.alloc(pngs.reduce((sum, { width, height }) => sum + width * height * 4 + 40, 6 + 16 * n));
    // write ICONDIR header
    buf.writeUInt16LE(0, 0);
    buf.writeUInt16LE(1, 2);
    buf.writeUInt16LE(n, 4);
    // process each png
    for (let i = 0, k = 6, dx = 6 + 16 * n; i < n; i += 1, k += 16) {
        const { width, height, pixels } = pngs[i]!,
            size = width * height * 4 + 40;
        // write ICONDIRENTRY
        buf.writeUInt8(width === 256 ? 0 : width, k);
        buf.writeUInt8(height === 256 ? 0 : height, k + 1);
        buf.writeUInt8(0, k + 2);
        buf.writeUInt8(0, k + 3);
        buf.writeUInt16LE(1, k + 4);
        buf.writeUInt16LE(32, k + 6);
        buf.writeUInt32LE(size, k + 8);
        buf.writeUInt32LE(dx, k + 12);
        // encode bitmap block (40 bytes)
        buf.writeUInt32LE(40, dx);
        buf.writeInt32LE(width, dx + 4);
        buf.writeInt32LE(height * 2, dx + 8);
        buf.writeUInt16LE(1, dx + 12);
        buf.writeUInt16LE(32, dx + 14);
        buf.writeUInt32LE(0, dx + 16);
        buf.writeUInt32LE(width * height, dx + 20);
        buf.writeInt32LE(0, dx + 24);
        buf.writeInt32LE(0, dx + 28);
        buf.writeUInt32LE(0, dx + 32);
        buf.writeUInt32LE(0, dx + 36);
        // encode dib
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const [pix, pos] = [(y * width + x) * 4, dx + 40 + ((height - y - 1) * width + x) * 4];
                buf.writeUInt8(pixels.readUInt8(pix + 2), pos);
                buf.writeUInt8(pixels.readUInt8(pix + 1), pos + 1);
                buf.writeUInt8(pixels.readUInt8(pix), pos + 2);
                buf.writeUInt8(pixels.readUInt8(pix + 3), pos + 3);
            }
        }
        // update image data offset
        dx += size;
    }
    return buf;
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256];

export default async function render(filePath: string) {
    log.info('rendering favicon');
    // render svg icon to use as basis for each image in the ico file
    const svg = renderToStaticMarkup(
        <ProjectLogo size={128} window={{ width: 0.95 }} decorations={false}/>,
    );
    // encode ico and save to file
    await writeToFile(filePath, await createFavicon(svg, icoSizes));
    log.info('wrote favicon to %S', filePath);
}