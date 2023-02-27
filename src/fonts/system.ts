import { getAvailableFonts } from 'fontmanager-redux';
import { compress as woff2Compress } from 'wawoff2';
import type { ContentSubsets } from './content';
import type { SystemFont } from './types';
import FontDecoder from './decoder';
import CodePointRange from './range';
import { styleAnsiMatchPriority } from './style';
import { subsetFontFile } from './subset';

export function systemFontPaths(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        getAvailableFonts((fonts) => {
            resolve([...new Set(fonts.map(({ path }) => path))]);
        });
    });
}

export async function getSystemFonts(match?: string[]) {
    // create a map of system font families
    const families: Record<string, SystemFont[]> = {},
        // instantiate font decoder
        decoder = new FontDecoder({ match });
    // extract system font info from each system font file
    for (const filePath of (await systemFontPaths())) {
        try {
            // decode the font file
            for (const font of (await decoder.decodeFileFonts(filePath))) {
                if (!families[font.family]) {
                    families[font.family] = [];
                }
                families[font.family]!.push(font);
            }
        } catch (e) {
            continue;
        }
    }
    return families;
}

export async function cssFromSystemFont(
    embeddedFamily: string,
    embedded: { css: string[], family: string[] },
    content: ContentSubsets,
    fonts: SystemFont[],
): Promise<ContentSubsets> {
    const fontCoverage = CodePointRange.mergeRanges(...fonts.map(({ coverage }) => coverage)),
        coverage = content.coverage.intersect(fontCoverage);
    if (coverage.intersection.empty()) return content;
    const uncovered: ContentSubsets = { coverage: coverage.difference, subsets: [] },
        fontMap = new Map<number, CodePointRange>();
    for (const [ansi, cp] of content.subsets) {
        let { intersection, difference } = cp.intersect(fontCoverage);
        if (!difference.empty()) uncovered.subsets.push([ansi, difference]);
        if (intersection.empty()) continue;
        // prioritize font styles according to how well they match the ansi code for this char subset
        for (const index of styleAnsiMatchPriority(fonts, ansi)) {
            const fontset = intersection.intersect(fonts[index]!.coverage);
            if (fontset.intersection.empty()) continue;
            fontMap.set(index, fontMap.has(index) ? fontMap.get(index)!.union(intersection) : intersection);
            intersection = fontset.difference;
            if (intersection.empty()) break;
        }
    }
    // boolean to track whether a subset actually gets embedded
    let fontEmbedded = false;
    // now, create css blocks from each font variant spec
    for (const [index, range] of fontMap.entries()) {
        const font = fonts[index]!,
            fontSubsetBuffer = await subsetFontFile(font, range);
        if (!fontSubsetBuffer) continue;
        // apply woff2 compression to font subset buffer
        let src: string;
        try {
            src = `url(data:font/woff2;charset=utf-8;base64,${
                Buffer.from(await woff2Compress(fontSubsetBuffer)).toString('base64')
            }) format(woff2)`;
        } catch (e) {
            src = `src:url(data:font/ttf;charset=utf-8;base64,${
                fontSubsetBuffer.toString('base64')
            }) format(truetype)`;
        }
        // add css block to array
        embedded.css.push(
            '@font-face {'
            + `font-family:'${embeddedFamily}';`
            + `font-style:${font.style.slant ? 'italic' : 'normal'};`
            + `font-weight:${font.style.weight};`
            + `src:${src}}`,
        );
        // add embedded family id to the font-family list if this is the first css block
        if (!fontEmbedded) embedded.family.push(embeddedFamily);
        // update font embedded status
        fontEmbedded = true;
    }
    return uncovered;
}