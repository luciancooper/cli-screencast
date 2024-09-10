import { parse as urlParse } from 'url';
import { isAbsolute, dirname, join, relative } from 'path';
import { constants as fsconstants } from 'fs';
import { access, readFile } from 'fs/promises';
import type { Transformer } from 'unified';
import type { Code, Parent } from 'mdast';
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
        rawSvg = await readFile(absPath, { encoding: 'utf8' });
    // replace code block with transformed node
    parent.children.splice(index, 1, {
        type: 'mdxJsxFlowElement',
        name: 'div',
        attributes: [{ type: 'mdxJsxAttribute', name: 'className', value: 'code-block-group' }],
        children: [{
            type: 'mdxJsxFlowElement',
            name: 'div',
            attributes: [{ type: 'mdxJsxAttribute', name: 'className', value: 'code-block-container' }],
            children: [node],
        }, {
            type: 'mdxJsxFlowElement',
            name: 'SVGFile',
            attributes: [
                { type: 'mdxJsxAttribute', name: 'rawSvg', value: rawSvg },
                { type: 'mdxJsxAttribute', name: 'title', value: 'result' },
                { type: 'mdxJsxAttribute', name: 'className', value: 'code-block-result' },
            ],
            children: [],
        }],
    });
}

export function codeBlockResult(options: Omit<Context, 'sourcePath'>): Transformer {
    return async (root, vfile) => {
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
        await Promise.all(promises);
    };
}