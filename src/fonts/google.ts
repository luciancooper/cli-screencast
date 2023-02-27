import https from 'https';
import type { AnsiCode, ContentSubsets } from './content';
import CodePointRange from './range';

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

/**
 * Make a GET request
 * @param url - request url
 * @returns fetched data
 */
export function fetchData(url: string): Promise<{ status: number, type?: string, data?: Buffer }> {
    return new Promise((resolve, reject) => {
        https.get(encodeURI(url), (res) => {
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
                resolve({
                    status,
                    type: res.headers['content-type'] ?? '',
                    data: Buffer.concat(chunks),
                });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
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
        coverage: CodePointRange.fromRanges(
            Object.values(coverage).flatMap((cov) => cov.split(',').map<[number, number]>((r) => {
                const { 1: i1, 2: i2 = i1 } = /(\d+)(?:-(\d+))?/.exec(r)!;
                return [parseInt(i1!, 10), parseInt(i2!, 10)];
            })),
        ),
    };
}

async function fetchFontSubset(embeddedFamily: string, url: string) {
    // fetch css from google api
    let css: string;
    try {
        const res = await fetchData(url);
        if (res.status !== 200) return '';
        css = res.data!.toString();
    } catch (error) {
        return '';
    }
    // replace @font-face family name with embedded font family
    css = css.replace(/font-family: ?'[^']+'(?=;)/g, `font-family: '${embeddedFamily}'`);
    // build a base-64 css string
    let base64 = '',
        idx = 0;
    // find all font urls to replace in css code
    for (let regex = /url\((https?:\/\/.+?)\)/g, m = regex.exec(css); m; m = regex.exec(css)) {
        const [urlIdx, fontUrl] = [m.index + m[0]!.indexOf(m[1]!), m[1]!],
            fetched = await fetchData(fontUrl);
        // replace the url in the css source code with fetched data base64 encoded
        base64 += `${css.slice(idx, urlIdx)}data:${fetched.type};charset=utf-8;base64,${fetched.data!.toString('base64')}`;
        idx = urlIdx + fontUrl.length;
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
    const subsetsIntersection: [AnsiCode, CodePointRange][] = [],
        subsetsDifference: [AnsiCode, CodePointRange][] = [];
    for (const [ansi, cp] of content.subsets) {
        const { intersection, difference } = cp.intersect(meta.coverage);
        if (!intersection.empty()) subsetsIntersection.push([ansi, intersection]);
        if (!difference.empty()) subsetsDifference.push([ansi, difference]);
    }
    const variants: { [K in GoogleFontVariantID]?: CodePointRange } = {};
    // loop through each covered subset
    for (const [ansi, chars] of subsetsIntersection) {
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
    // font family google uri base
    const urlBase = `https://fonts.googleapis.com/css2?family=${meta.family.replace(' ', '+')}`;
    // boolean to track whether a fetched font actually gets embedded
    let fontEmbedded = false;
    // fetch font style character subsets
    for (const [key, range] of Object.entries(variants)) {
        // fetch css from google fonts api
        const block = await fetchFontSubset(embeddedFamily, `${urlBase}${StyleParams[key]!}&text=${range.chars()}`);
        if (!block) continue;
        // add css block to embedded font data
        embedded.css.push(block);
        // add embedded family id to the font-family list if this is the first css block
        if (!fontEmbedded) embedded.family.push(embeddedFamily);
        // update font embedded status
        fontEmbedded = true;
    }
    return { coverage: coverage.difference, subsets: subsetsDifference };
}