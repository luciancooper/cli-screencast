import { resolve as resolvePath } from 'path';
import { URL } from 'url';
import FontDecoder from '@src/fonts/decoder';
import { CodePointRange } from '@src/fonts/range';
import type { FontSource, SfntHeader, SystemFont } from '@src/fonts/types';

async function decodeFonts(src: FontSource) {
    const fonts: SystemFont[] = [];
    for await (const font of new FontDecoder().decodeFonts({ ...src })) fonts.push(font);
    return fonts;
}

test('static font', async () => {
    const src = { file: resolvePath(__dirname, './fonts/Monaco.ttf') };
    await expect(decodeFonts(src)).resolves.toStrictEqual<SystemFont[]>([{
        src,
        family: 'Monaco',
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
    }]);
});

test('variable font', async () => {
    const src = { file: resolvePath(__dirname, './fonts/CascadiaCode.ttf') };
    await expect(decodeFonts(src)).resolves.toStrictEqual<SystemFont[]>([{
        src,
        family: 'Cascadia Code',
        style: { weight: 200, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        fvarInstance: { coords: { wght: 200 }, defscore: 0 },
    }, {
        src,
        family: 'Cascadia Code',
        style: { weight: 300, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        fvarInstance: { coords: { wght: 300 }, defscore: 0 },
    }, {
        src,
        family: 'Cascadia Code',
        style: { weight: 350, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        fvarInstance: { coords: { wght: 350 }, defscore: 0 },
    }, {
        src,
        family: 'Cascadia Code',
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        fvarInstance: { coords: { wght: 400 }, defscore: 0 },
    }, {
        src,
        family: 'Cascadia Code',
        style: { weight: 600, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        fvarInstance: { coords: { wght: 600 }, defscore: 0 },
    }, {
        src,
        family: 'Cascadia Code',
        style: { weight: 700, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        fvarInstance: { coords: { wght: 700 }, defscore: 0 },
    }]);
});

test('ttc font collection', async () => {
    const src = { file: resolvePath(__dirname, './fonts/Menlo.ttc') };
    await expect(decodeFonts(src)).resolves.toStrictEqual<SystemFont[]>([{
        src,
        family: 'Menlo',
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        ttcSubfont: expect.any(Object) as SfntHeader,
    }, {
        src,
        family: 'Menlo',
        style: { weight: 700, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        ttcSubfont: expect.any(Object) as SfntHeader,
    }, {
        src,
        family: 'Menlo',
        style: { weight: 400, width: 5, slant: 2 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        ttcSubfont: expect.any(Object) as SfntHeader,
    }, {
        src,
        family: 'Menlo',
        style: { weight: 700, width: 5, slant: 2 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        ttcSubfont: expect.any(Object) as SfntHeader,
    }]);
});

test('woff2 tcc font collection', async () => {
    const src = { file: resolvePath(__dirname, './fonts/Courier.woff2') };
    await expect(decodeFonts(src)).resolves.toStrictEqual<SystemFont[]>([{
        src: { ...src, woff2: true },
        family: 'Courier',
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        ttcSubfont: expect.any(Object) as SfntHeader,
    }, {
        src: { ...src, woff2: true },
        family: 'Courier',
        style: { weight: 700, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        ttcSubfont: expect.any(Object) as SfntHeader,
    }, {
        src: { ...src, woff2: true },
        family: 'Courier',
        style: { weight: 400, width: 5, slant: 1 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        ttcSubfont: expect.any(Object) as SfntHeader,
    }, {
        src: { ...src, woff2: true },
        family: 'Courier',
        style: { weight: 700, width: 5, slant: 1 },
        coverage: expect.any(CodePointRange) as CodePointRange,
        ttcSubfont: expect.any(Object) as SfntHeader,
    }]);
});

test('remote static font', async () => {
    const src = { file: new URL('https://fontlib.s3.amazonaws.com/Consolas/Consola.ttf') };
    await expect(decodeFonts(src)).resolves.toStrictEqual<SystemFont[]>([{
        src,
        family: 'Consolas',
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
    }]);
});

test('remote woff2 static font', async () => {
    const src = { file: new URL('https://fontlib.s3.amazonaws.com/Consolas/woff2/Consola.woff2') };
    await expect(decodeFonts(src)).resolves.toStrictEqual<SystemFont[]>([{
        src: { ...src, woff2: true },
        family: 'Consolas',
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
    }]);
});