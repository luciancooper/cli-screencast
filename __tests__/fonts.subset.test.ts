import path from 'path';
import type { FontData } from '@src/fonts/types';
import { CodePointRange } from '@src/fonts/range';
import FontDecoder from '@src/fonts/decoder';
import { subsetFontFile } from '@src/fonts/subset';

function* cpIterator(chars: string): IterableIterator<number> {
    for (const c of chars) {
        yield c.codePointAt(0)!;
    }
}

test('subsets font files', async () => {
    const decoder = new FontDecoder(),
        fonts = await decoder.decodeFileFonts(path.resolve(__dirname, './fonts/Monaco.ttf'));
    expect(fonts).toHaveLength(1);
    const subset = await subsetFontFile(fonts[0]!, cpIterator('abc'));
    expect(Buffer.isBuffer(subset)).toBe(true);
    const subsetFonts = await decoder.decodeBufferFonts(subset!);
    expect(subsetFonts).toStrictEqual<FontData[]>([{
        family: expect.toBeString(),
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
    }]);
    expect(subsetFonts[0]!.coverage.ranges).toStrictEqual([[97, 100, expect.toBeNumber()]]);
});

test('subsets fonts with font variations', async () => {
    const decoder = new FontDecoder(),
        fonts = await decoder.decodeFileFonts(path.resolve(__dirname, './fonts/CascadiaCode.ttf'));
    expect(fonts).toHaveLength(6);
    const subset = await subsetFontFile(
        fonts.find(({ style }) => style.weight === 400)!,
        cpIterator('abc'),
    );
    expect(Buffer.isBuffer(subset)).toBe(true);
    const subsetFonts = await decoder.decodeBufferFonts(subset!);
    expect(subsetFonts).toStrictEqual<FontData[]>([{
        family: expect.toBeString(),
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
    }]);
    expect(subsetFonts[0]!.coverage.ranges).toStrictEqual([[97, 100, expect.toBeNumber()]]);
});

test('subsets ttc subfonts', async () => {
    const decoder = new FontDecoder(),
        fonts = await decoder.decodeFileFonts(path.resolve(__dirname, './fonts/Menlo.ttc'));
    expect(fonts).toHaveLength(4);
    const subset = await subsetFontFile(
        fonts.find(({ style }) => style.weight === 400 && style.slant === 0)!,
        cpIterator('abc'),
    );
    expect(Buffer.isBuffer(subset)).toBe(true);
    const subsetFonts = await decoder.decodeBufferFonts(subset!);
    expect(subsetFonts).toStrictEqual<FontData[]>([{
        family: expect.toBeString(),
        style: { weight: 400, width: 5, slant: 0 },
        coverage: expect.any(CodePointRange) as CodePointRange,
    }]);
    expect(subsetFonts[0]!.coverage.ranges).toStrictEqual([[97, 100, expect.toBeNumber()]]);
});