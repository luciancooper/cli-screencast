import { launch, type Browser } from 'puppeteer';
import type { Size, SVGFrameData } from '../types';
import PNG from './png';
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
            log.info('rendering animated png from svg (%k total frames)', data.frames.length);
            // create empty png
            png = new PNG();
            // render png buffer for each frame
            for (const [idx, { frame, time, endTime }] of data.frames.entries()) {
                log.info('adding frame %k of %k', idx + 1, data.frames.length);
                png.addFrame(await renderer(frame), endTime - time);
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