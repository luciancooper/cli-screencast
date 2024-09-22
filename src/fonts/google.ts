import type { AnsiCode, ContentSubsets } from './content';
import { CodePointRange, type GraphemeSet } from './range';
import type { ResolvedFontFamily, ResolvedFontAccumulator, EmbeddedFontAccumulator } from './types';
import { fetchData } from '../utils';
import log from '../logger';

const StyleID = ['400', '700', '400i', '700i'] as const;

export type GoogleFontVariantID = (typeof StyleID)[number];

const StyleFallbacks: Record<GoogleFontVariantID, GoogleFontVariantID[]> = {
    400: ['700', '400i', '700i'],
    700: ['400', '700i', '400i'],
    '400i': ['700i', '400', '700'],
    '700i': ['400i', '700', '400'],
};

const StyleParams: Record<string, string> = {
    400: ':ital,wght@0,400',
    700: ':ital,wght@0,700',
    '400i': ':ital,wght@1,400',
    '700i': ':ital,wght@1,700',
} as const;

// user-agent for requests to fonts.googleapis.com/css2
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';

/**
 * The google fonts api does not include variation selectors within the code points provided by
 * the 'coverage' field of a font's metadata file. Therefore we will just assume that all
 * google fonts support the variation selectors unicode block (FE00 - FE0F).
 */
class GoogleFontCoverage extends CodePointRange {
    override contains(code: number) {
        const k = super.contains(code);
        // include variation selectors
        return k !== false ? k : (code >= 0xFE00 && code <= 0xFE0F) ? undefined : false;
    }
}

export interface GoogleFontMetadata {
    family: string
    styles: GoogleFontVariantID[]
    coverage: CodePointRange
}

export async function fetchGoogleFontMetadata(font: string): Promise<GoogleFontMetadata | null> {
    let [fontFamily] = font.split(',') as [string];
    fontFamily = fontFamily.trim().replace(/(?:^["']|["']$)/g, '');
    // fetch metadata from google fonts api
    let data: Buffer;
    try {
        const res = await fetchData(`https://fonts.google.com/metadata/fonts/${fontFamily}`);
        if (res.status === 404) return null;
        data = res.data!;
    } catch (error) {
        log.warn("error occured fetching google font metadata for '%s':\n  %e", fontFamily, { error });
        return null;
    }
    const { family, fonts, coverage } = JSON.parse(data.toString('utf8').replace(/^[^{]+/, '')) as {
        family: string
        fonts: Record<string, any>
        coverage: Record<string, string>
    };
    return {
        family,
        styles: (Object.keys(fonts) as GoogleFontVariantID[]).filter((k) => StyleID.includes(k)),
        coverage: GoogleFontCoverage.fromRanges(
            Object.values(coverage).flatMap((cov) => cov.split(',').map<[cp1: number, cp2: number]>((r) => {
                const { 1: i1, 2: i2 = i1 } = /(\d+)(?:-(\d+))?/.exec(r)!;
                return [parseInt(i1!, 10), parseInt(i2!, 10) + 1];
            })),
        ),
    };
}

type ResolvedGoogleFontFamily = Extract<ResolvedFontFamily, { type: 'google' }>;

export async function resolveGoogleFont(
    { families, columnWidth }: ResolvedFontAccumulator,
    content: ContentSubsets,
    meta: GoogleFontMetadata,
): Promise<ContentSubsets> {
    // create array of resolved fonts
    const resolved: ResolvedGoogleFontFamily['fonts'] = [];
    // add resolved family object to the resolved families array
    families.push({ name: meta.family, type: 'google', fonts: resolved });
    // calculate intersection between content and family coverage
    const coverage = content.coverage.intersect(meta.coverage);
    // stop if no chars are covered by this font
    if (coverage.intersection.empty()) return content;
    // determine content coverage for each ansi style subset
    const subsets: [ansi: AnsiCode, subset: GraphemeSet][] = [],
        contentDifference: ContentSubsets = { coverage: coverage.difference, subsets: [] };
    for (const [ansi, chars] of content.subsets) {
        const { intersection, difference } = chars.intersect(meta.coverage);
        if (!intersection.empty()) subsets.push([ansi, intersection]);
        if (!difference.empty()) contentDifference.subsets.push([ansi, difference]);
    }
    const variants: { [K in GoogleFontVariantID]?: GraphemeSet } = {};
    // loop through each covered subset
    for (const [ansi, chars] of subsets) {
        let key = StyleID[ansi];
        // find a variant fallback key if necessary
        if (!meta.styles.includes(key)) {
            const fallbacks = StyleFallbacks[key],
                fbKey = fallbacks.find((k) => meta.styles.includes(k));
            if (!fbKey) continue;
            key = fbKey;
        }
        variants[key] = variants[key] ? variants[key]!.union(chars) : chars;
    }
    // font family base url params
    const baseParams = `family=${meta.family.replace(/ /g, '+')}`;
    // fetch font style character subsets
    for (const [key, chars] of Object.entries(variants)) {
        // create url params
        const params = baseParams + StyleParams[key]!;
        // add font spec
        resolved.push({ params, chars: chars.string() });
        // add to columnWidth array
        columnWidth.push([chars.length, undefined]);
    }
    log.debug(
        "resolved font coverage from google font family '%s':"
        + '\n  • weight: %k, style: %k, coverage: %O'.repeat(resolved.length),
        meta.family,
        ...resolved.flatMap(({ params: p, chars: c }) => [p.slice(-3), p.slice(-5, -4) === '1' ? 'italic' : 'normal', c]),
    );
    // return remaining content difference
    return contentDifference;
}

export async function embedGoogleFont(
    embedded: EmbeddedFontAccumulator,
    { name, fonts }: Omit<ResolvedGoogleFontFamily, 'type'>,
    fullCoverage: boolean,
) {
    if (fonts.length) {
        log.debug("embedding font %s google font family '%s'", embedded.svg ? 'subset from' : 'css for', name);
    }
    // add family name to the font-family list
    if (fonts.length || !fullCoverage) embedded.family.push(name);
    // fetch font style character subsets
    for (const { params, chars } of fonts) {
        // fetch css from google fonts api
        let css: string;
        try {
            const res = await fetchData({
                host: 'fonts.googleapis.com',
                path: `/css2?${encodeURI(`${params}&text=${chars}`)}`,
                headers: { 'User-Agent': UA },
            });
            if (res.status !== 200) {
                log.warn('received response status %k when attempting fetch google font css', res.status);
                continue;
            }
            css = res.data!.toString();
        } catch (error) {
            log.warn("error occured fetching google font css for '%s':\n  %e", name, { error });
            continue;
        }
        // replace @font-face family name with embedded font family
        css = css.replace(/font-family: ?'[^']+'(?=;)/g, `font-family:'${name}'`);
        // remove any comments returned by the google fonts api
        css = css.replace(/^\/\* .+\*\/\n/gm, '').trim();
        // remove newlines & extra whitespace from each @font-face declaration
        css = css.split(/\n(?=@font-face)/g).map((fontFace) => fontFace.replace(/\s*\n\s*/g, '').trim()).join('\n');
        // if embedding css for png, add code with urls in it
        embedded.png?.push(css);
        // stop if not embedding for svg
        if (!embedded.svg) continue;
        // build a base-64 css string
        let [base64, idx] = ['', 0];
        // find all font urls to replace in css code
        for (let regex = /url\((https?:\/\/.+?)\)/g, m = regex.exec(css); m; m = regex.exec(css)) {
            // add preceeding css & the src descriptor
            base64 += css.slice(idx, m.index);
            // update index within the css source
            idx = m.index + m[0].length;
            // fetch font from the source url
            let fontData = m[0];
            try {
                const res = await fetchData(m[1]!);
                if (res.status === 200) {
                    // sometimes google fonts api returns woff2 data with a 'content-type' text/html header.
                    const type = res.type?.startsWith('font/') ? res.type : 'font/woff2';
                    fontData = `url(data:${type};charset=utf-8;base64,${res.data!.toString('base64')})`;
                } else log.warn('received response status %k when attempting to fetch google font data', res.status);
            } catch (error) {
                log.warn('error occured fetching google font data:\n  %e', { error });
            }
            // replace the url in the css source code with fetched data base64 encoded
            base64 += fontData;
        }
        // return css with font urls replace with base64 encoded versions
        css = base64 + css.slice(idx);
        // add css block to embedded font data
        embedded.svg.push(css);
    }
}