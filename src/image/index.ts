import puppeteer from 'puppeteer';
import { SVGData } from '../types';
import { setPixelDensity } from './png';

function createBrowser(): Promise<puppeteer.Browser> {
    return puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
}

function wrapHtml(svg: string) {
    const cssReset = 'body,html{margin:0;}',
        head = `<head><style>${cssReset}</style></head>`,
        body = `<body>${svg}</body>`;
    return `<html>${head + body}</html>`;
}

export async function renderPng({ width, height, svg }: SVGData, scale: number): Promise<Buffer> {
    const browser = await createBrowser(),
        page = await browser.newPage();
    // prevent HTTP requests over the network
    await page.setOfflineMode(true);
    // set viewport
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    // load svg content
    await page.setContent(wrapHtml(svg));
    // render screenshot
    const buffer = await page.screenshot({ type: 'png', omitBackground: true }) as Buffer;
    // close browser
    await browser.close();
    // encode png pixels per inch into buffer
    return setPixelDensity(buffer, scale * 72);
}