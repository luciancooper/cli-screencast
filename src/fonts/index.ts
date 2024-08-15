import type { ResolvedFontFamily, ResolvedFontAccumulator, EmbeddedFontAccumulator } from './types';
import extractContentSubsets, { createContentSubsets, type FrameData, type ContentSubsets } from './content';
import { caselessMatch } from './names';
import { getSystemFonts, resolveSystemFont, embedSystemFont } from './system';
import { fetchGoogleFontMetadata, resolveGoogleFont, embedGoogleFont } from './google';
import log from '../logger';

const genericFamilies = [
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
    'emoji', 'math', 'fangsong',
];

export interface ResolvedFontData {
    fontFamilies: ResolvedFontFamily[]
    fullCoverage: boolean
    fontColumnWidth: number | undefined
}

/**
 * Resolve the fonts for all text content of a screenshot or screencast.
 * @param data - screenshot or screencast data or a string
 * @param fontFamily - the css font family spec
 * @param fonts - additional font file paths or urls to resolve fonts from
 */
export async function resolveFonts(
    data: FrameData | ContentSubsets | string,
    fontFamily: string,
    fonts?: string[],
): Promise<ResolvedFontData> {
    // create code point subset object from font data
    let subsets = (typeof data === 'string') ? createContentSubsets([data])
        : ('coverage' in data) ? data : extractContentSubsets(data);
    // stop if frame data has no text
    if (subsets.coverage.empty()) {
        return { fontFamilies: [], fullCoverage: true, fontColumnWidth: undefined };
    }
    // create array of specified font families
    const familyNames = fontFamily.split(',').map((f) => f.trim().replace(/(?:^["']|["']$)/g, '')),
        // fetch system fonts
        systemFonts = await getSystemFonts({ match: familyNames, fonts }),
        // get system font keys
        systemFontKeys = Object.keys(systemFonts),
        // create object to accumulate resolved font data
        resolved: ResolvedFontAccumulator = { families: [], columnWidth: [] };
    // iterate over specified font families
    for (const name of familyNames) {
        // if family is a generic key, add it to the embedded family spec and continue
        if (genericFamilies.includes(name.toLocaleLowerCase())) {
            resolved.families.push({ name: name.toLocaleLowerCase(), type: 'generic' });
            continue;
        }
        // check if specified font is installed locally
        const sid = caselessMatch(systemFontKeys, name);
        if (sid) {
            // resolve from locally installed system font
            subsets = await resolveSystemFont(resolved, subsets, { name: sid, fonts: systemFonts[sid]! });
            continue;
        }
        // check if specified font can be fetched from the google fonts api
        const meta = await fetchGoogleFontMetadata(name);
        if (meta) {
            // resolve from google fonts api
            subsets = await resolveGoogleFont(resolved, subsets, meta);
            continue;
        }
        // otherwise add null family to resolved list
        resolved.families.push({ name, type: null });
    }
    // select column width
    const widthMap = new Map<number | undefined, number>();
    for (const [count, k] of resolved.columnWidth) widthMap.set(k, (widthMap.get(k) ?? 0) + count);
    const [fontColumnWidth] = [...widthMap.entries()].sort(([x, a], [y, b]) => (b - a || (y ?? 0) - (x ?? 0)))[0] ?? [];
    if (fontColumnWidth) log.debug('column width resolved from font coverage: %k', fontColumnWidth);
    // return resolved fonts data
    return {
        fontFamilies: resolved.families,
        fullCoverage: subsets.coverage.empty(),
        fontColumnWidth,
    };
}

export interface EmbeddedFontData {
    svg: string | null
    png: string | null
    fontFamily: string
}

/**
 * Create css code for embedded font subsets.
 * @param fontData - resolved font families array and char coverage status
 * @param forPng - whether the css is intended for content that is being rendered to png
 * @returns font family string & embedded css code
 */
export async function embedFontCss(
    { fontFamilies, fullCoverage }: Omit<ResolvedFontData, 'fontColumnWidth'>,
    { png, svg }: { png: boolean, svg: boolean },
): Promise<EmbeddedFontData> {
    // create object to accumulate embedded font data
    const embedded: EmbeddedFontAccumulator = {
        svg: svg ? [] : null,
        png: png ? [] : null,
        family: [],
    };
    // build font css
    for (const family of fontFamilies) {
        if (family.type === 'system') {
            await embedSystemFont(embedded, family, fullCoverage);
        } else if (family.type === 'google') {
            await embedGoogleFont(embedded, family, fullCoverage);
        } else if (family.type === 'generic' || !fullCoverage) {
            embedded.family.push(family.name);
        }
    }
    // append generic 'monospace' family to the end of the font-family spec
    if (!embedded.family.includes('monospace')) {
        embedded.family.push('monospace');
    }
    // return embedded font css & font-family value
    return {
        png: embedded.png?.join('\n') || null,
        svg: embedded.svg?.join('\n') || null,
        fontFamily: embedded.family.map((family) => (family.includes(' ') ? `"${family}"` : family)).join(','),
    };
}