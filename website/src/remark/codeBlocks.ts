import { parse as urlParse } from 'url';
import { isAbsolute, dirname, join, relative, extname } from 'path';
import { constants as fsconstants } from 'fs';
import { access, readFile } from 'fs/promises';
import type { Transformer } from 'unified';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { Code, Image, Parent, RootContent } from 'mdast';
import { visit } from 'unist-util-visit';

interface Context {
    staticDirectories: string[]
    siteDir: string
    sourcePath: string
}

function parseFilePath(filePath: string) {
    // stop if path is a url
    const parsed = urlParse(filePath);
    if (parsed.protocol || !parsed.pathname) return null;
    return parsed.pathname;
}

async function exists(absPath: string) {
    try {
        await access(absPath, fsconstants.F_OK);
        return true;
    } catch (e) {
        return false;
    }
}

async function resolveAbsolutePath(filePath: string, { siteDir, staticDirectories, sourcePath }: Context) {
    let assetPath: string | null = null;
    if (filePath.startsWith('@site/')) {
        const absPath = join(siteDir, filePath.replace('@site/', ''));
        if (await exists(absPath)) assetPath = absPath;
    } else if (isAbsolute(filePath)) {
        // Absolute paths are expected to exist in the static folder.
        for (const staticDir of staticDirectories) {
            const absPath = join(siteDir, staticDir, filePath);
            if (!(await exists(absPath))) continue;
            assetPath = absPath;
            break;
        }
    } else {
        // relative paths are resolved against the source file's folder
        const absPath = join(dirname(sourcePath), filePath);
        if (await exists(absPath)) assetPath = absPath;
    }
    if (!assetPath) {
        throw new Error(`File ${filePath} used in ${
            relative(process.cwd(), sourcePath)
        } not found`);
    }
    return assetPath;
}

async function processCodeResults(
    [node, index, parent]: [node: Code, index: number, parent: Parent],
    { resultFile, ...context }: Context & { resultFile: string },
) {
    // resolve file path
    const filePath = parseFilePath(resultFile);
    if (!filePath) return;
    // get abs path to results file
    const absPath = await resolveAbsolutePath(filePath, context),
        // read the raw svg file content
        rawSvg = await readFile(absPath, { encoding: 'utf8' }),
        // create SVGFile mdxJsxFlowElement
        svgJsx: MdxJsxFlowElement = {
            type: 'mdxJsxFlowElement',
            name: 'SVGFile',
            attributes: [
                { type: 'mdxJsxAttribute', name: 'rawSvg', value: rawSvg },
                { type: 'mdxJsxAttribute', name: 'title', value: 'result' },
                { type: 'mdxJsxAttribute', name: 'className', value: 'code-block-result' },
            ],
            children: [],
        };
    // check if parent node is not a `codeblockgroup`
    if (parent.type !== 'codeblockgroup') {
        // replace code block with a `codeblockgroup` node
        const group = { type: 'codeblockgroup', children: [node, svgJsx] };
        parent.children.splice(index, 1, group as RootContent);
    } else {
        // node is already in a `codeblockgroup`
        parent.children.splice(index + 1, 0, svgJsx);
    }
}

function adjacentNodeSpan(parent: Parent, index: number): [number, number] {
    // find span of adjacent nodes of the same type as child at index
    const { type } = parent.children[index];
    let [i, j] = [index, index + 1];
    // look back at preceding children
    for (; i > 0; i -= 1) {
        if (parent.children[i - 1].type !== type) break;
    }
    // look forward at following children
    for (let n = parent.children.length; j < n; j += 1) {
        if (parent.children[j].type !== type) break;
    }
    return [i, j];
}

export function codeBlockMeta(options: Omit<Context, 'sourcePath'>): Transformer {
    return async (root, vfile) => {
        // visit each code node and look for `codeBlockGroup` in its metadata
        visit(root, 'code', (node: Code, index: number, parent: Parent) => {
            // stop if the code node does not have `codeBlockGroup` in its metadata
            if (!node.meta?.includes('codeBlockGroup')) return;
            // stop if the code is already a codeblockgroup child
            if (parent.type === 'codeblockgroup') return;
            // find adjacent `code` nodes
            const [i, j] = adjacentNodeSpan(parent, index);
            // nest all code blocks in this group in a `codeblockgroup` type parent node
            for (let idx = i; idx < j; idx += 1) {
                const group = {
                    type: 'codeblockgroup',
                    children: [parent.children[idx]],
                };
                parent.children.splice(idx, 1, group as RootContent);
            }
        });
        // visit each code node and look for `result` in its metadata
        const promises: Promise<void>[] = [];
        visit(root, 'code', (node: Code, index: number, parent: Parent) => {
            // stop if the code node has no metadata
            if (!node.meta) return;
            // match result='...' metadata
            const match = /result\s*=\s*(['"])([^'"]+?)\1/.exec(node.meta ?? '');
            if (!match) return;
            // get result file
            const resultFile = match[2];
            // add processing promise
            promises.push(processCodeResults(
                [node, index, parent],
                { resultFile, sourcePath: vfile.path, ...options },
            ));
        });
        // finish async processing of result metadata
        await Promise.all(promises);
        // transform all `codeblockgroup` nodes
        visit(root, 'codeblockgroup', (node: Code, index: number, parent: Parent) => {
            // find adjacent `codeblockgroup` nodes
            const [i, j] = adjacentNodeSpan(parent, index);
            // replace span of `codeblockgroup` nodes with one transformed mdxJsxFlowElement
            parent.children.splice(i, j - i, {
                type: 'mdxJsxFlowElement',
                name: 'div',
                attributes: [{ type: 'mdxJsxAttribute', name: 'className', value: 'code-block-group' }],
                // flatten all child nodes
                children: (parent.children.slice(i, j) as Parent[])
                    .flatMap(({ children }) => children)
                    .map((e) => (e.type === 'code' ? {
                        type: 'mdxJsxFlowElement',
                        name: 'div',
                        attributes: [{ type: 'mdxJsxAttribute', name: 'className', value: 'code-block-container' }],
                        children: [e],
                    } : e)) as MdxJsxFlowElement['children'],
            });
        });
    };
}

async function processImageNode([node, parent]: [node: Image, parent: Parent], context: Context) {
    // resolve file path
    const filePath = parseFilePath(node.url);
    if (!filePath) return;
    // ensure file is yaml, json, or a js / ts code file
    const ext = extname(filePath);
    if (!/^\.(?:yaml|json|[cm]?[jt]sx?)$/.test(ext)) return;
    // get abs path to file
    const absPath = await resolveAbsolutePath(filePath, context);
    // read the file contents
    let value = await readFile(absPath, { encoding: 'utf8' });
    // trim whitespace
    value = value.trimEnd();
    // wipe the parent paragraph node
    for (const key of Object.keys(parent)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete parent[key];
    }
    // transform parent node into a code block
    Object.assign(parent, {
        type: 'code',
        lang: ext.slice(1),
        // determine code meta data
        meta: node.title ? `${(node.alt ?? '')}title='${node.title}'` : node.alt ? `title='${node.alt}'` : null,
        value,
    });
}

export function codeFileBlocks(options: Omit<Context, 'sourcePath'>): Transformer {
    return async (root, vfile) => {
        const promises: Promise<void>[] = [];
        visit(root, 'image', (node: Image, index: number, parent: Parent) => {
            // stop if image does not have a url
            if (!node.url) return;
            // stop if node is not the only child of a paragraph
            if (index !== 0 || parent.children.length > 1 || parent.type !== 'paragraph') return;
            // add processing promise
            promises.push(processImageNode([node, parent], { ...options, sourcePath: vfile.path }));
        });
        await Promise.all(promises);
    };
}