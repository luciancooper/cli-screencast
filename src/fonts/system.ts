import { resolve as resolvePath } from 'path';
import { promises as fs } from 'fs';
import systemFontPaths from 'system-font-paths';
import { compress as woff2Compress } from 'wawoff2';
import type { Optionalize } from '../types';
import type { ContentSubsets } from './content';
import type { SystemFont, SystemFontData, ResolvedFontFamily, ResolvedFontAccumulator, EmbeddedFontAccumulator } from './types';
import FontDecoder from './decoder';
import { CodePointRange, type MeasuredGraphemeSet } from './range';
import { parseUrl, getFontBuffer } from './utils';
import { styleAnsiMatchPriority } from './style';
import { subsetFontFile } from './subset';
import log from '../logger';

export async function getSystemFonts({ match, fonts = [] }: Optionalize<{ match?: string[], fonts?: string[] }> = {}) {
    // create a map of system font families
    const families: Record<string, SystemFont[]> = {},
        // instantiate font decoder
        decoder = new FontDecoder({ match }),
        // find installed system fonts
        systemFonts = await systemFontPaths();
    // decode specified fonts
    for (const fontSrc of fonts) {
        const url = parseUrl(fontSrc);
        if (url) {
            try {
                // decode the downloaded font buffer
                for await (const font of decoder.decodeFonts({ file: url, specified: true })) {
                    families[font.family] ||= [];
                    families[font.family]!.push(font);
                }
            } catch (error: unknown) {
                log.warn('error decoding font fetched from %S: %s', url.href, (error as { message: string }).message);
            }
            continue;
        }
        const file = resolvePath(fontSrc);
        try {
            // check if this font is installed locally as a system font
            const idx = systemFonts.indexOf(file);
            if (idx >= 0) systemFonts.splice(idx, 1);
            // decode the font file
            for await (const font of decoder.decodeFonts({ file, specified: true, installed: idx >= 0 })) {
                families[font.family] ||= [];
                families[font.family]!.push(font);
            }
        } catch (error: unknown) {
            switch ((error as { code?: string }).code) {
                case 'EISDIR':
                    log.warn('specified font path: %S is a directory', file);
                    break;
                case 'ENOENT':
                    log.warn('specified font path: %S does not exist', file);
                    break;
                default:
                    log.warn('error decoding font path %S: %s', file, (error as { message: string }).message);
                    break;
            }
        }
    }
    // extract system font info from each system font file
    for (const file of systemFonts) {
        try {
            // decode the system font file
            for await (const font of decoder.decodeFonts({ file, installed: true })) {
                families[font.family] ||= [];
                families[font.family]!.push(font);
            }
        } catch (e) {
            continue;
        }
    }
    return families;
}

export function systemFontData(font: SystemFont): SystemFontData {
    const data: SystemFontData = {
        src: font.src,
        style: font.style.slant ? 'italic' : 'normal',
        weight: font.style.weight,
    };
    if (font.fvarInstance) data.fvar = [...Object.entries(font.fvarInstance.coords)];
    if (font.ttcSubfont) data.ttcSubfont = font.ttcSubfont;
    return data;
}

type ResolvedSystemFontFamily = Extract<ResolvedFontFamily, { type: 'system' }>;

export async function resolveSystemFont(
    { families, columnWidth }: ResolvedFontAccumulator,
    content: ContentSubsets,
    { name, fonts }: { name: string, fonts: SystemFont[] },
): Promise<ContentSubsets> {
    // create array of resolved fonts
    const resolved: ResolvedSystemFontFamily['fonts'] = [];
    // add resolved family object to the resolved families array
    families.push({ name, type: 'system', fonts: resolved });
    // stop if content coverage is empty
    if (content.coverage.empty()) return content;
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
    // now, create css blocks from each font variant spec
    for (const [index, chars] of map.entries()) {
        const font = fonts[index]!;
        // add to columnWidth array
        columnWidth.push(...chars.widthDistribution());
        // create font data object
        const data = systemFontData(font);
        // add this font to accumulated family object
        resolved.push({ data, chars: chars.string() });
    }
    // log debug message about resolved fonts and their sources
    log.debug(
        "resolved font coverage from font family '%s':"
        + '%s    • weight: %k, style: %k, coverage: %O'.repeat(resolved.length),
        name,
        ...[...resolved.reduce(
            (m, { data: { src, weight, style }, chars }) => {
                if (!m.has(src)) m.set(src, []);
                m.get(src)!.push([weight, style, chars]);
                return m;
            },
            new Map<SystemFont['src'], [weight: number, style: string, chars: string][]>(),
        ).entries()].flatMap(([src, styles]) => (
            [log.printf('\n  Source %k:\n', src.file), ...styles.flatMap((s, j) => (j ? ['\n  ', ...s] : s))]
        )),
    );
    // return remaining char coverage difference
    return contentDifference;
}

async function cssFontUrl(buf: Buffer) {
    try {
        return `url(data:font/woff2;charset=utf-8;base64,${
            Buffer.from(await woff2Compress(buf)).toString('base64')
        }) format(woff2)`;
    } catch (error) {
        log.warn('woff2 compression error occurred: %e', { error });
        return `url(data:font/ttf;charset=utf-8;base64,${
            buf.toString('base64')
        }) format(truetype)`;
    }
}

async function cssPngFontSrc(data: Pick<SystemFontData, 'src' | 'ttcSubfont'>) {
    // shortcut for remote fonts that are not within font collections
    if (!data.ttcSubfont && typeof data.src.file !== 'string') {
        return `url(${data.src.file.href}) format(${data.src.woff2 ? 'woff2' : 'opentype'})`;
    }
    // shortcut for local woff2 fonts that are not within font collections
    if (!data.ttcSubfont && data.src.woff2) {
        return `url(data:font/woff2;charset=utf-8;base64,${
            (await fs.readFile(data.src.file)).toString('base64')
        }) format(woff2)`;
    }
    // if font is in a ttc collection it must be extracted, or else style variations will not work
    const buf = await getFontBuffer(data);
    if (!buf) return null;
    return cssFontUrl(buf);
}

function cssFontFace(family: string, { style, weight }: Pick<SystemFontData, 'style' | 'weight'>, src: string) {
    return '@font-face {'
        + `font-family:'${family}';`
        + `font-style:${style};`
        + `font-weight:${weight};`
        + `src:${src}}`;
}

export async function embedSystemFont(
    embedded: EmbeddedFontAccumulator,
    { name, fonts }: Omit<ResolvedSystemFontFamily, 'type'>,
    fullCoverage: boolean,
) {
    if (embedded.svg && fonts.length) log.debug("embedding font subset from font family '%s'", name);
    // add family name to the font-family list
    if (fonts.length || !fullCoverage) embedded.family.push(name);
    // now, create css blocks from each font variant spec
    for (const { data, chars } of fonts) {
        // check for fonts that are not locally installed when embedding for png
        if (embedded.png && !data.src.installed) {
            const src = await cssPngFontSrc(data);
            if (src) embedded.png.push(cssFontFace(name, data, src));
        }
        // stop if not embedding for svg
        if (!embedded.svg) continue;
        // subset font file
        const fontSubsetBuffer = await subsetFontFile(data, chars);
        if (!fontSubsetBuffer) {
            log.warn('failed to subset font %S with coverage %O', data.src.file, chars);
            continue;
        }
        // apply woff2 compression to font subset buffer
        const src = await cssFontUrl(fontSubsetBuffer);
        // add css block to array
        embedded.svg.push(cssFontFace(name, data, src));
    }
}