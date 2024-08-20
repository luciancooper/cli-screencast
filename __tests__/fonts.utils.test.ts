import nock from 'nock';
import { URL } from 'url';
import { resolve as resolvePath } from 'path';
import { applyLoggingOptions, resetLogLevel } from '@src/logger';
import FontDecoder from '@src/fonts/decoder';
import type { FontSource, SystemFont, FontData } from '@src/fonts/types';
import { getFontBuffer } from '@src/fonts/utils';

beforeAll(() => {
    applyLoggingOptions({ logLevel: 'error' });
});

afterEach(() => {
    nock.cleanAll();
});

afterAll(() => {
    resetLogLevel();
});

async function decodeFirstFont(source: Buffer): Promise<FontData>;
async function decodeFirstFont(source: FontSource): Promise<[FontSource, FontData]>;
async function decodeFirstFont(source: FontSource | Buffer) {
    const decoder = new FontDecoder();
    if (Buffer.isBuffer(source)) {
        // decode buffer
        decoder.setBuffer(source);
        const each = decoder.decodeAll(decoder.decodeSfntSystemFonts),
            { value } = (await each.next()) as IteratorYieldResult<FontData>;
        // finish the generator to close the file
        await each.return(null);
        return value;
    }
    const each = decoder.decodeFonts({ ...source }),
        { value: { src, ...font } } = (await each.next()) as IteratorYieldResult<SystemFont>;
    // finish the generator to close the file
    await each.return(null);
    return [src, font];
}

describe('getFontBuffer', () => {
    test('static font', async () => {
        const file = resolvePath(__dirname, './fonts/Monaco.ttf'),
            [src, font] = await decodeFirstFont({ file }),
            buffer = await getFontBuffer({ src, ...font });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        await expect(decodeFirstFont(buffer!)).resolves.toStrictEqual(font);
    });

    test('woff2 static font', async () => {
        const file = resolvePath(__dirname, './fonts/Consola.woff2'),
            [src, font] = await decodeFirstFont({ file }),
            buffer = await getFontBuffer({ src, ...font });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        await expect(decodeFirstFont(buffer!)).resolves.toStrictEqual(font);
    });

    test('remote static font', async () => {
        const file = new URL('https://fontlib.s3.amazonaws.com/Consolas/Consola.ttf'),
            [src, font] = await decodeFirstFont({ file }),
            buffer = await getFontBuffer({ src, ...font });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        await expect(decodeFirstFont(buffer!)).resolves.toStrictEqual(font);
    });

    test('remote woff2 static font', async () => {
        const file = new URL('https://fontlib.s3.amazonaws.com/Consolas/woff2/Consola.woff2'),
            [src, font] = await decodeFirstFont({ file }),
            buffer = await getFontBuffer({ src, ...font });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        await expect(decodeFirstFont(buffer!)).resolves.toStrictEqual(font);
    });

    test('tcc font collection', async () => {
        const file = resolvePath(__dirname, './fonts/Menlo.ttc'),
            [src, font] = await decodeFirstFont({ file }),
            buffer = await getFontBuffer({ src, ...font });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        // delete the ttc header from the original font data
        delete font.ttcSubfont;
        await expect(decodeFirstFont(buffer!)).resolves.toStrictEqual(font);
    });

    test('woff2 tcc font collection', async () => {
        const file = resolvePath(__dirname, './fonts/Courier.woff2'),
            [src, font] = await decodeFirstFont({ file }),
            buffer = await getFontBuffer({ src, ...font });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        // delete the ttc header from the original font data
        delete font.ttcSubfont;
        await expect(decodeFirstFont(buffer!)).resolves.toStrictEqual(font);
    });

    test('remote tcc font collection', async () => {
        const file = new URL('https://fontlib.s3.amazonaws.com/PTMono/PTMono.ttc'),
            [src, font] = await decodeFirstFont({ file }),
            buffer = await getFontBuffer({ src, ...font });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        // delete the ttc header from the original font data
        delete font.ttcSubfont;
        await expect(decodeFirstFont(buffer!)).resolves.toStrictEqual(font);
    });

    test('remote woff2 tcc font collection', async () => {
        const file = new URL('https://fontlib.s3.amazonaws.com/PTMono/PTMono.woff2'),
            [src, font] = await decodeFirstFont({ file }),
            buffer = await getFontBuffer({ src, ...font });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        // delete the ttc header from the original font data
        delete font.ttcSubfont;
        await expect(decodeFirstFont(buffer!)).resolves.toStrictEqual(font);
    });

    describe('errors', () => {
        test('http error fetching remote static font', async () => {
            const file = new URL('https://fontlib.s3.amazonaws.com/Consolas/Consola.ttf'),
                [src, font] = await decodeFirstFont({ file });
            nock('https://fontlib.s3.amazonaws.com').get(() => true).replyWithError('mocked network error');
            await expect(getFontBuffer({ src, ...font })).resolves.toBeNull();
        });

        test('http error fetching remote tcc font collection', async () => {
            const file = new URL('https://fontlib.s3.amazonaws.com/PTMono/PTMono.ttc'),
                [src, font] = await decodeFirstFont({ file });
            nock('https://fontlib.s3.amazonaws.com').get(() => true).replyWithError('mocked network error');
            await expect(getFontBuffer({ src, ...font })).resolves.toBeNull();
        });
    });
});