import puppeteer from 'puppeteer';
import { Size, SVGData, SVGCaptureData } from '../types';
import PNG from './png';

function createBrowser(): Promise<puppeteer.Browser> {
    return puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
}

async function createImageRenderer({ width, height }: Size, deviceScaleFactor: number) {
    const browser = await createBrowser(),
        page = await browser.newPage();
    // prevent HTTP requests over the network
    await page.setOfflineMode(true);
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
        const buffer = await page.screenshot({ type: 'png', omitBackground: true }) as Buffer;
        return buffer;
    };
    render.close = async () => {
        // close browser
        await browser.close();
    };
    return render;
}

export async function createPng({ svg, ...size }: SVGData, scale: number): Promise<Buffer> {
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
    return png.pack();
}

export async function createAnimatedPng({ frames, ...size }: SVGCaptureData, scale: number): Promise<Buffer> {
    const png = new PNG({ width: size.width * scale, height: size.height * scale });
    // set png pixels per inch
    png.setPixelDensity(scale * 72);
    png.setText('Software', 'cli-screencast');
    // create renderer
    const renderer = await createImageRenderer(size, scale);
    // render png buffer for each frame
    for (const { svg, time, endTime } of frames) {
        png.addFrame(await renderer(svg), endTime - time);
    }
    // close renderer
    await renderer.close();
    // return encoded png buffer
    return png.pack();
}