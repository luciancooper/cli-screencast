import log from '../logger';
import type { ResolvedFontFamily } from './types';
import extractContentSubsets, { createContentSubsets, type FrameData, type ContentSubsets } from './content';
import { getSystemFonts, resolveSystemFont, embedSystemFont } from './system';
import { fetchGoogleFontMetadata, resolveGoogleFont, embedGoogleFont } from './google';

function uuid(length: number): string {
    let id = '';
    for (let i = 0; i < length; i += 1) id += String.fromCharCode(97 + Math.floor(Math.random() * 26));
    return id;
}

const genericFamilies = [
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
    'emoji', 'math', 'fangsong',
];

export interface ResolvedFontData {
    fontFamilies: ResolvedFontFamily[]
    fontColumnWidth: number | undefined
}

/**
 * Resolve the fonts for all text content of a screenshot or screencast.
 * @param data - screenshot or screencast data or a string
 * @param fontFamily - the css font family spec
 */
export async function resolveFonts(
    data: FrameData | ContentSubsets | string,
    fontFamily: string,
): Promise<ResolvedFontData> {
    // create code point subset object from font data
    let subsets = (typeof data === 'string') ? createContentSubsets([data])
        : ('coverage' in data) ? data : extractContentSubsets(data);
    // stop if frame data has no text
    if (subsets.coverage.empty()) {
        return { fontFamilies: [], fontColumnWidth: undefined };
    }
    // create array of specified font families
    const familyNames = fontFamily.split(',').map((f) => f.trim().replace(/(?:^["']|["']$)/g, '')),
        // fetch system fonts
        systemFonts = await getSystemFonts(familyNames),
        // create object to accumulate resolved font data
        resolved: { families: ResolvedFontFamily[], columnWidth: [number, number | undefined][] } = {
            families: [],
            columnWidth: [],
        };
    // iterate over specified font families
    for (let i = 0; i < familyNames.length; i += 1) {
        const name = familyNames[i]!;
        // if family is a generic key, add it to the embedded family spec and continue
        if (genericFamilies.includes(name)) {
            resolved.families.push({ name, type: 'generic' });
            continue;
        }
        // check if specified font is installed locally
        if (systemFonts[name]) {
            // resolve from locally installed system font
            subsets = await resolveSystemFont(resolved, subsets, { name, fonts: systemFonts[name]! });
        } else {
            // check if specified font can be fetched from the google fonts api
            const meta = await fetchGoogleFontMetadata(name);
            if (meta) subsets = await resolveGoogleFont(resolved, subsets, meta);
        }
        if (subsets.coverage.empty()) {
            resolved.families.push(
                ...familyNames.slice(i + 1)
                    .filter((n) => genericFamilies.includes(n))
                    .map((n) => ({ name: n, type: 'generic' } as const)),
            );
            break;
        }
    }
    // select column width
    const widthMap = new Map<number | undefined, number>();
    for (const [count, k] of resolved.columnWidth) widthMap.set(k, (widthMap.get(k) ?? 0) + count);
    const [fontColumnWidth] = [...widthMap.entries()].sort(([x, a], [y, b]) => (b - a || (y ?? 0) - (x ?? 0)))[0] ?? [];
    // return resolved fonts data
    return { fontFamilies: resolved.families, fontColumnWidth };
}

/**
 * Create css code with embedded font subsets.
 * @param fontFamilies - resolved font families array
 * @returns css code
 */
export async function embedFontCss(
    fontFamilies: ResolvedFontFamily[],
    forPng = false,
): Promise<{ css: string, fontFamily: string } | null> {
    // create a unique id for this screencast
    const id = uuid(12),
        // create object to accumulate embedded font data
        embedded: { css: string[], family: string[] } = { css: [], family: [] };
    // build font css
    for (const family of fontFamilies) {
        // create a unique font family name for this family
        const uuidName = `sc-${id}-${embedded.family.length + 1}`;
        if (family.type === 'system') {
            if (!forPng) {
                log.debug('embedding font subset from locally installed font %s', family.name);
                await embedSystemFont(embedded, family.fonts, uuidName);
            } else embedded.family.push(family.name);
        } else if (family.type === 'google') {
            if (!forPng) log.debug('embedding font subset from google font family %s', family.name);
            await embedGoogleFont(embedded, family.fonts, forPng ? family.name : uuidName, forPng);
        } else {
            embedded.family.push(family.name);
        }
    }
    if (!embedded.css.length) return null;
    // append generic 'monospace' family to the end of the font-family spec
    if (!embedded.family.includes('monospace')) {
        embedded.family.push('monospace');
    }
    // return embedded font info
    return {
        css: embedded.css.join('\n'),
        fontFamily: embedded.family.map((family) => (family.includes(' ') ? `"${family}"` : family)).join(','),
    };
}