import { launch, type Browser } from 'puppeteer';
import type { Size, SVGFrameData } from '../types';
import PNG, { type PNGData } from './png';
import log from '../logger';

function createBrowser(): Promise<Browser> {
    return launch({
        headless: 'shell',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
}

async function createImageRenderer(size: Size, deviceScaleFactor: number) {
    const [width, height] = [Math.ceil(size.width), Math.ceil(size.height)];
    log.debug('creating png renderer (size: %k x %k)', width, height);
    // create puppeteer browser and page
    const browser = await createBrowser(),
        page = await browser.newPage();
    // set viewport
    await page.setViewport({ width, height, deviceScaleFactor });
    // create render function
    const render = async (svg: string) => {
        const cssReset = 'body,html{margin:0;}',
            head = `<head><style>${cssReset}</style></head>`,
            body = `<body>${svg}</body>`,
            html = `<html>${head + body}</html>`;
        // load svg content
        await page.setContent(html);
        // render screenshot
        const buffer = await page.screenshot({ type: 'png', omitBackground: true });
        return buffer;
    };
    render.close = async () => {
        // close browser
        await browser.close();
    };
    return render;
}

export async function createPng({ width, height, ...data }: SVGFrameData, scale: number): Promise<Buffer> {
    let png: PNG;
    // create image renderer
    const renderer = await createImageRenderer({ width, height }, scale);
    try {
        if ('frames' in data) {
            // array of memoization indexes for memoizable frames
            const mindexes = data.frames.filter(({ memoidx }) => (memoidx != null)).map(({ memoidx }) => memoidx!);
            log.info('rendering animated png from svg (%k frames to render)', data.frames.length - mindexes.length);
            // create map to store cached frames
            const cache = new Map<number, PNGData | null>([...new Set(mindexes)].map((i) => [i, null]));
            // create empty png
            png = new PNG();
            // render png buffer for each frame
            let count = 0;
            for (const [idx, { time, endTime, ...content }] of data.frames.entries()) {
                let frame: PNGData;
                if (content.memoidx == null) {
                    // eslint-disable-next-line no-plusplus
                    log.info('rendering png frame %k of %k', ++count, data.frames.length - mindexes.length);
                    // render png screenshot
                    frame = PNG.decodePixels(await renderer(content.frame));
                    // add rendered png to memoization cache if there is a duplicate frame
                    if (cache.has(idx)) cache.set(idx, frame);
                } else {
                    frame = cache.get(content.memoidx)!;
                }
                // add frame to png
                png.addFrame(frame, endTime - time);
            }
        } else {
            log.info('rendering png from svg');
            // render screenshot
            const buffer = await renderer(data.frame);
            // decode png
            png = new PNG(buffer);
        }
    } finally {
        // close renderer
        await renderer.close();
    }
    // set png pixels per inch
    png.setPixelDensity(scale * 72);
    png.setText('Software', 'cli-screencast');
    // return encoded png buffer
    log.info('packing png');
    return png.pack();
}