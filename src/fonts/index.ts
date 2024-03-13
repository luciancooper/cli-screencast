import log from '../logger';
import extractContentSubsets, { createContentSubsets, type FrameData, type ContentSubsets } from './content';
import { getSystemFonts, cssFromSystemFont } from './system';
import { fetchGoogleFontMetadata, cssFromGoogleFont } from './google';

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

/**
 * Create css code with the embedded font subset required
 * for the text content of a screenshot or screencast.
 * @param data - screenshot or screencast data or a string
 * @param fontFamily - the css font family spec
 * @returns css code
 */
export default async function createFontCss(
    data: FrameData | ContentSubsets | string,
    fontSpec: string,
): Promise<{ css: string, fontFamily: string } | { css: null }> {
    // create code point subset object from font data
    let subsets = (typeof data === 'string') ? createContentSubsets([data])
        : ('coverage' in data) ? data : extractContentSubsets(data);
    // stop if frame data has no text
    if (subsets.coverage.empty()) return { css: null };
    // create array of specified font families
    const families = fontSpec.split(',').map((f) => f.trim().replace(/(?:^["']|["']$)/g, '')),
        // fetch system fonts
        systemFonts = await getSystemFonts(families),
        // create a unique id for this screencast
        id = uuid(12),
        // create object to accumulate embedded font data
        embedded: { css: string[], family: string[] } = { css: [], family: [] };
    // build font css
    for (const family of families) {
        // if family is a generic key, add it to the embedded family spec and continue
        if (genericFamilies.includes(family)) {
            embedded.family.push(family);
            continue;
        }
        // create a unique font family name for this family
        const embeddedFamily = `sc-${id}-${embedded.family.length + 1}`;
        // check if specified font is installed locally
        if (systemFonts[family]) {
            log.debug('extracting font subset from locally installed font %s', family);
            subsets = await cssFromSystemFont(embeddedFamily, embedded, subsets, systemFonts[family]!);
        } else {
            // check if specified font can be fetched from the google fonts api
            const meta = await fetchGoogleFontMetadata(family);
            if (meta) {
                log.debug('downloading font subset from google font family %s', family);
                subsets = await cssFromGoogleFont(embeddedFamily, embedded, subsets, meta);
            }
        }
        if (subsets.coverage.empty()) break;
    }
    if (!embedded.css.length) return { css: null };
    // append generic 'monospace' family to the end of the font-family spec
    if (!embedded.family.includes('monospace')) {
        embedded.family.push('monospace');
    }
    return { css: embedded.css.join('\n'), fontFamily: embedded.family.join(',') };
}