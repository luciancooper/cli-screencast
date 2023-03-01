import https from 'https';
import type { AnsiCode, ContentSubsets } from './content';
import { CodePointRange, type GraphemeSet } from './range';

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

interface FetchResponse {
    /** http status code */
    status: number
    /** 'content-type' response header */
    type?: string
    /** request response data buffer */
    data?: Buffer
}

/**
 * Make a GET request
 * @param req - request url or options object
 * @returns fetched data
 */
export function fetchData(req: string | https.RequestOptions): Promise<FetchResponse> {
    return new Promise((resolve, reject) => {
        https.get(typeof req === 'string' ? encodeURI(req) : req, (res) => {
            const status = res.statusCode!;
            if (status >= 400) {
                resolve({ status });
                return;
            }
            const chunks: Uint8Array[] = [];
            // handle response chunks
            res.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            res.on('error', (err) => {
                reject(err);
            });
            // response complete
            res.on('end', () => {
                const type = res.headers['content-type'] ?? '';
                resolve({ status, type, data: Buffer.concat(chunks) });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * The google fonts api does not include variation selectors within the code points provided by
 * the 'coverage' field of a font's metadata file. Therefore we will just assume that all
 * google fonts support the variation selectors unicode block (FE00 - FE0F).
 */
class GoogleFontCoverage extends CodePointRange {
    override contains(code: number): boolean {
        return super.contains(code) || (code >= 0xFE00 && code <= 0xFE0F); // include variation selectors
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
            Object.values(coverage).flatMap((cov) => cov.split(',').map<[number, number]>((r) => {
                const { 1: i1, 2: i2 = i1 } = /(\d+)(?:-(\d+))?/.exec(r)!;
                return [parseInt(i1!, 10), parseInt(i2!, 10) + 1];
            })),
        ),
    };
}

async function fetchFontSubset(embeddedFamily: string, urlParams: string) {
    // fetch css from google api
    let css: string;
    try {
        const res = await fetchData({
            host: 'fonts.googleapis.com',
            path: `/css2?${encodeURI(urlParams)}`,
            headers: { 'User-Agent': UA },
        });
        if (res.status !== 200) return '';
        css = res.data!.toString();
    } catch (error) {
        return '';
    }
    // replace @font-face family name with embedded font family
    css = css.replace(/font-family: ?'[^']+'(?=;)/g, `font-family:'${embeddedFamily}'`);
    // remove any comments returned by the google fonts api
    css = css.replace(/^\/\* .+\*\/\n/gm, '').trim();
    // remove newlines & extra whitespace from each @font-face declaration
    css = css.split(/\n(?=@font-face)/g).map((fontFace) => fontFace.replace(/\s*\n\s*/g, '').trim()).join('\n');
    // build a base-64 css string
    let [base64, idx] = ['', 0];
    // find all font urls to replace in css code
    for (let regex = /url\((https?:\/\/.+?)\)/g, m = regex.exec(css); m; m = regex.exec(css)) {
        // add preceeding css & the src descriptor
        base64 += css.slice(idx, m.index);
        // fetch font from the source url
        const fontData = await fetchData(m[1]!);
        // replace the url in the css source code with fetched data base64 encoded
        base64 += `url(data:${fontData.type!};charset=utf-8;base64,${fontData.data!.toString('base64')})`;
        // update index within the css source
        idx = m.index + m[0].length;
    }
    // return css with font urls replace with base64 encoded versions
    return base64 + css.slice(idx);
}

export async function cssFromGoogleFont(
    embeddedFamily: string,
    embedded: { css: string[], family: string[] },
    content: ContentSubsets,
    meta: GoogleFontMetadata,
): Promise<ContentSubsets> {
    const coverage = content.coverage.intersect(meta.coverage);
    if (coverage.intersection.empty()) return content;
    const subsets: [AnsiCode, GraphemeSet][] = [],
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
    // boolean to track whether a fetched font actually gets embedded
    let fontEmbedded = false;
    // fetch font style character subsets
    for (const [key, chars] of Object.entries(variants)) {
        // fetch css from google fonts api
        const params = `${baseParams}${StyleParams[key]!}&text=${chars.string()}`,
            block = await fetchFontSubset(embeddedFamily, params);
        if (!block) continue;
        // add css block to embedded font data
        embedded.css.push(block);
        // add embedded family id to the font-family list if this is the first css block
        if (!fontEmbedded) embedded.family.push(embeddedFamily);
        // update font embedded status
        fontEmbedded = true;
    }
    return contentDifference;
}