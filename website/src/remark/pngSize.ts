import { isAbsolute, dirname, join, relative } from 'path';
import { constants as fsconstants } from 'fs';
import { access, readFile } from 'fs/promises';
import type { Transformer } from 'unified';
import type { MdxJsxTextElement, MdxJsxAttributeValueExpression } from 'mdast-util-mdx-jsx';
import { visit } from 'unist-util-visit';

function decodePngSize(png: Buffer) {
    if ([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].some((bit, i) => png[i] !== bit)) {
        throw new Error('Invalid .png file header');
    }
    const size = { width: 0, height: 0, scaled: false };
    for (let idx = 8, first = true; idx < png.length;) {
        // Read the length of the current chunk, which is stored as a Uint32.
        const length = png.readUInt32BE(idx),
            // Get the name in ASCII for identification.
            type = png.toString('utf8', idx += 4, idx += 4);
        // The IHDR header MUST come first.
        if (first) {
            if (type !== 'IHDR') throw new Error('IHDR header missing');
            // read width & height from IHDR header
            size.width = png.readUInt32BE(idx);
            size.height = png.readUInt32BE(idx + 4);
        } else if (type === 'pHYs') {
            // decode pHYs chunk
            const [x, y, unit] = [png.readUInt32BE(idx), png.readUInt32BE(idx + 4), png[idx + 8]];
            // scale width & height if unit is 1 (meter)
            if (unit === 1) {
                size.width /= Math.round(x * 0.0254 / 72);
                size.height /= Math.round(y * 0.0254 / 72);
                size.scaled = true;
            }
            break;
        } else if (type === 'IDAT' || type === 'IEND') {
            // the pHYs chunk must preceed the first IDAT chunk, and the IEND header marks the end of the file.
            break;
        }
        // increment the buffer index, skipping the CRC value
        idx += length + 4;
        // update first chunk flag
        first = false;
    }
    return size;
}

async function processPng(node: MdxJsxTextElement, filePath: string) {
    // check if file exists
    try {
        await access(filePath, fsconstants.F_OK);
    } catch {
        throw new Error(`File ${relative(process.cwd(), filePath)} not found`);
    }
    // read file & decode png size
    const size = decodePngSize(await readFile(filePath));
    if (!size.scaled) return;
    // find and update the width jsx attribute
    const width = node.attributes.find((attr) => (attr.type === 'mdxJsxAttribute' && attr.name === 'width'));
    if (width) width.value = String(size.width);
    // find and update the height jsx attribute
    const height = node.attributes.find((attr) => (attr.type === 'mdxJsxAttribute' && attr.name === 'height'));
    if (height) height.value = String(size.height);
}

export default function plugin(): Transformer {
    return async (root, vfile) => {
        const promises: Promise<void>[] = [];
        visit(root, 'mdxJsxTextElement', (node: MdxJsxTextElement) => {
            if (node.name !== 'img') return;
            const src = node.attributes.find((attr) => (attr.type === 'mdxJsxAttribute' && attr.name === 'src'));
            if (!src) return;
            const value = (src.value as MdxJsxAttributeValueExpression)?.value ?? src.value as string;
            if (!value.startsWith('require("')) return;
            // match png path from within webpack require url
            const match = /!([^!]+?\.png)/.exec(value.slice(9, value.indexOf('")')));
            if (!match) return;
            let path = match[1];
            // relative paths are resolved against the source file's folder
            if (!isAbsolute(path)) path = join(dirname(vfile.path), path);
            // add png processing promise
            promises.push(processPng(node, path));
        });
        // await all png processing promises
        await Promise.all(promises);
    };
}