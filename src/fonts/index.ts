import extractContentSubsets, { type FrameData, type ContentSubsets } from './content';
import { getSystemFonts, cssFromSystemFont } from './system';
import { fetchGoogleFontMetadata, cssFromGoogleFont } from './google';

/**
 * Create css code with the embedded font subset required
 * for the text content of a screenshot or screencast.
 * @param data - screenshot or screencast data
 * @param fontFamily - the css font family spec
 * @returns css code
 */
export default async function createFontCss(
    data: FrameData | ContentSubsets,
    fontSpec: string,
): Promise<string | null> {
    // create code point subset object from font data
    let subsets = ('coverage' in data) ? data : extractContentSubsets(data);
    // stop if frame data has no text
    if (subsets.coverage.empty()) return null;
    // create array of specified font families
    const families = fontSpec.split(',').map((f) => f.trim().replace(/(?:^["']|["']$)/g, '')),
        // fetch system fonts
        systemFonts = await getSystemFonts(families),
        // array of css blocks
        cssBlocks: string[] = [];
    // build font css
    for (const family of families) {
        if (systemFonts[family]) {
            subsets = await cssFromSystemFont(cssBlocks, subsets, systemFonts[family]!);
        } else {
            const meta = await fetchGoogleFontMetadata(family);
            if (meta) {
                subsets = await cssFromGoogleFont(cssBlocks, subsets, meta);
            }
        }
        if (subsets.coverage.empty()) break;
    }
    return cssBlocks.length ? cssBlocks.join('\n') : null;
}