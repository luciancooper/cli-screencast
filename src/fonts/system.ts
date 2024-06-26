import systemFontPaths from 'system-font-paths';
import { compress as woff2Compress } from 'wawoff2';
import type { ContentSubsets } from './content';
import type { SystemFont, SystemFontData, ResolvedFontFamily } from './types';
import FontDecoder from './decoder';
import { CodePointRange, type MeasuredGraphemeSet } from './range';
import { styleAnsiMatchPriority } from './style';
import { subsetFontFile } from './subset';

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
                families[font.family] ||= [];
                families[font.family]!.push(font);
            }
        } catch (e) {
            continue;
        }
    }
    return families;
}

type ResolvedSystemFonts = Extract<ResolvedFontFamily, { type: 'system' }>['fonts'];

export async function resolveSystemFont(
    { families, columnWidth }: { families: ResolvedFontFamily[], columnWidth: [number, number | undefined][] },
    content: ContentSubsets,
    { name, fonts }: { name: string, fonts: SystemFont[] },
): Promise<ContentSubsets> {
    // accumulated code point coverage for this font family
    const fontCoverage = CodePointRange.merge(...fonts.map(({ coverage }) => coverage)),
        // total subset of chars covered by this font
        coverage = content.coverage.intersect(fontCoverage);
    // stop if no chars are covered by this font
    if (coverage.intersection.empty()) return content;
    // create map of applied font families
    const contentDifference: ContentSubsets = { coverage: coverage.difference, subsets: [] },
        map = new Map<number, MeasuredGraphemeSet>();
    // break down covereage by ansi style
    for (const [ansi, chars] of content.subsets) {
        // subset of these ansi styled chars covered by this font
        let { intersection, difference } = chars.intersect(fontCoverage);
        if (!difference.empty()) contentDifference.subsets.push([ansi, difference]);
        if (intersection.empty()) continue;
        // prioritize font styles according to how well they match the ansi code for this char subset
        for (const i of styleAnsiMatchPriority(fonts, ansi)) {
            const fontset = intersection.measuredIntersection(fonts[i]!.coverage);
            if (fontset.intersection.empty()) continue;
            map.set(i, map.has(i) ? map.get(i)!.union(fontset.intersection) : fontset.intersection);
            intersection = fontset.difference;
            if (intersection.empty()) break;
        }
    }
    // create font family data object
    const resolved: ResolvedSystemFonts = [];
    // now, create css blocks from each font variant spec
    for (const [index, chars] of map.entries()) {
        const font = fonts[index]!;
        // add to columnWidth array
        columnWidth.push(...chars.widthDistribution());
        // create font data object
        const data: SystemFontData = {
            filePath: font.filePath,
            style: font.style.slant ? 'italic' : 'normal',
            weight: font.style.weight,
        };
        if (font.fvarInstance) data.fvar = [...Object.entries(font.fvarInstance.coords)];
        if (font.ttcSubfont) data.ttcSubfont = font.ttcSubfont;
        // add this font to accumulated family object
        resolved.push({ data, chars: chars.string() });
    }
    // add family to resolved families array
    families.push({ name, type: 'system', fonts: resolved });
    return contentDifference;
}

export async function embedSystemFont(
    embedded: { css: string[], family: string[] },
    fonts: ResolvedSystemFonts,
    embeddedFamily: string,
) {
    // boolean to track whether a subset actually gets embedded
    let fontEmbedded = false;
    // now, create css blocks from each font variant spec
    for (const { data, chars } of fonts) {
        // subset font file
        const fontSubsetBuffer = await subsetFontFile(data, chars);
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
            + `font-style:${data.style};`
            + `font-weight:${data.weight};`
            + `src:${src}}`,
        );
        // add embedded family id to the font-family list if this is the first css block
        if (!fontEmbedded) embedded.family.push(embeddedFamily);
        // update font embedded status
        fontEmbedded = true;
    }
}