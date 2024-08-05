import { launch, type Browser } from 'puppeteer';
import type { Size, SVGData, SVGCaptureData } from '../types';
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

export async function createPng({ svg, ...size }: SVGData, scale: number): Promise<Buffer> {
    log.info('rendering png from svg');
    const renderer = await createImageRenderer(size, scale),
        // render screenshot
        buffer = await renderer(svg);
    // close renderer
    await renderer.close();
    // decode png
    const png = new PNG(buffer);
    // set png pixels per inch
    png.setPixelDensity(scale * 72);
    png.setText('Software', 'cli-screencast');
    // return encoded png buffer
    log.info('packing png');
    return png.pack();
}

export async function createAnimatedPng({ frames, ...size }: SVGCaptureData, scale: number): Promise<Buffer> {
    log.info('rendering animated png from svg (%k total frames)', frames.length);
    const png = new PNG(),
        // create renderer
        renderer = await createImageRenderer(size, scale);
    // render png buffer for each frame
    for (const [idx, { svg, time, endTime }] of frames.entries()) {
        log.info('adding frame %k of %k', idx + 1, frames.length);
        png.addFrame(await renderer(svg), endTime - time);
    }
    // close renderer
    await renderer.close();
    // set png pixels per inch
    png.setPixelDensity(scale * 72);
    png.setText('Software', 'cli-screencast');
    // return encoded png buffer
    log.info('packing animated png');
    return png.pack();
}