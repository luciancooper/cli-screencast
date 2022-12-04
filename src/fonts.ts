import https from 'https';
import type { TerminalLines, Title } from './types';

type AnsiIndex = 0 | 1 | 2 | 3;

interface FontAxisSpec {
    name: string
    key: string
    ansi: AnsiIndex
    fallback: AnsiIndex[]
    styleParam: string
}

const fontAxis: FontAxisSpec[] = [{
    name: 'regular',
    key: '400',
    ansi: 0,
    fallback: [],
    styleParam: ':ital,wght@0,400',
}, {
    name: 'bold',
    key: '700',
    ansi: 1,
    fallback: [0],
    styleParam: ':ital,wght@0,700',
}, {
    name: 'italic',
    key: '400i',
    ansi: 2,
    fallback: [0],
    styleParam: ':ital,wght@1,400',
}, {
    name: 'bold-italic',
    key: '700i',
    ansi: 3,
    fallback: [1, 2, 0],
    styleParam: ':ital,wght@1,700',
}];

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

interface FontMetadata {
    family: string
    styles: string[]
}

export async function fetchFontMetadata(font: string): Promise<FontMetadata | null> {
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
    const { family, fonts } = JSON.parse(data.toString('utf8').replace(/^[^{]+/, '')) as { family: string, fonts: Record<string, any> };
    return {
        family,
        styles: fontAxis.map(({ key }) => key).filter((k) => !!fonts[k]),
    };
}

type TermScreen = TerminalLines & { title: Title };

type FrameData = TermScreen | TermScreen[] | { content: TerminalLines[], title: Title[] };

function* extractChunks(data: FrameData) {
    if (Array.isArray(data)) {
        // ScreenData[]
        for (const frame of data) {
            yield* frame.title.chunks;
            for (const line of frame.lines) {
                yield* line.chunks;
            }
        }
    } else if ('content' in data) {
        // CaptureData
        for (const frame of data.title) {
            yield* frame.chunks;
        }
        for (const frame of data.content) {
            for (const line of frame.lines) {
                yield* line.chunks;
            }
        }
    } else {
        // ScreenData
        yield* data.title.chunks;
        for (const line of data.lines) {
            yield* line.chunks;
        }
    }
}

function* extractChunkSubsets(data: FrameData, fontStyles: string[]) {
    const axisMask = fontAxis.map(({ key }) => fontStyles.includes(key)),
        axisMap = fontAxis.map(({ ansi, fallback }) => ([ansi, ...fallback].find((i) => axisMask[i]) ?? 0));
    for (const { str, style } of extractChunks(data)) {
        const text = [...str.replace(/\s/g, '')]
            .filter((c) => (c.codePointAt(0)! < 0x20FF))
            .join('');
        if (text) {
            // [strikeThrough, inverse, underline, italic, dim, bold]
            const ansi = (style.props & 1) | ((style.props >>> 1) & 2);
            yield [axisMap[ansi]!, text] as const;
        }
    }
}

export function determineFontSubsets(data: FrameData, fontStyles: string[]) {
    const charSubsets = new Array<string>(fontAxis.length).fill('');
    for (const [idx, text] of extractChunkSubsets(data, fontStyles)) {
        charSubsets[idx] += text;
    }
    const subsets: { styleParam: string, chars: string }[] = [];
    for (const [idx, { styleParam }] of fontAxis.entries()) {
        let chars = charSubsets[idx]!;
        if (chars) {
            chars = [...new Set([...chars])].sort().join('');
            subsets.push({ styleParam, chars });
        }
    }
    return subsets;
}

async function fetchFontSubset(url: string) {
    // fetch css from google api
    let css: string;
    try {
        const res = await fetchData(url);
        if (res.status !== 200) return '';
        css = res.data!.toString();
    } catch (error) {
        return '';
    }
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

/**
 * Fetch the required css code for a chunk of text
 * @param string - the text the font will apply to
 * @param fontFamily - the name of the font to use
 * @returns css code
 */
export default async function fetchFontCss(data: FrameData, fontFamily: string): Promise<string | null> {
    // fetch font metadata
    const meta = await fetchFontMetadata(fontFamily);
    if (!meta) return null;
    let css = '';
    // font family google uri base
    const urlBase = `https://fonts.googleapis.com/css2?family=${meta.family.replace(' ', '+')}`;
    // calculate font style character subsets
    for (const { styleParam, chars } of determineFontSubsets(data, meta.styles)) {
        // fetch css from google fonts api
        css += await fetchFontSubset(`${urlBase}${styleParam}&text=${chars}`);
    }
    return css;
}