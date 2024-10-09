import remarkDeflist from 'remark-deflist';
import type { Transformer } from 'unified';
import type { Parent } from 'unist';
import { visit } from 'unist-util-visit';

const deflist = remarkDeflist();

export default function plugin(): Transformer {
    return async (root, vfile, ...args) => {
        // check for 'api' keyword in head metadata
        const { frontMatter } = vfile.data as { frontMatter?: { keywords?: string[] } },
            api = frontMatter?.keywords?.some((kw) => (kw.toLowerCase() === 'api')) ?? false;
        // run wrapped `remark-deflist` plugin
        deflist(root, vfile, ...args);
        // transform all `descriptionlist` nodes
        visit(root, 'descriptionlist', (node: Parent, idx: number, parent: Parent) => {
            if (node.children[0]?.type !== 'descriptionterm') return;
            // collect deflist dt & dd pairs
            let last = -1;
            const defs: { dt: Parent, dd: Parent[] }[] = [];
            for (let i = last + 1; i < node.children.length; i += 1) {
                if (node.children[i]?.type === 'descriptionterm') {
                    if (last >= 0) {
                        defs.push({
                            dt: node.children[last] as Parent,
                            dd: node.children.slice(last + 1, i) as Parent[],
                        });
                    }
                    last = i;
                }
            }
            if (last >= 0) {
                defs.push({
                    dt: node.children[last] as Parent,
                    dd: node.children.slice(last + 1) as Parent[],
                });
            }
            // transform deflist into custom transformed-deflist element
            const transformed: Parent = {
                type: 'transformedDeflist',
                data: {
                    hName: 'div',
                    hProperties: { className: `transformed-deflist${api ? ' options-reference' : ''}` },
                },
                children: defs.map(({ dt, dd }) => ({
                    type: 'transformedDeflistGroup',
                    data: { hName: 'div', hProperties: { className: 'group' } },
                    children: [{
                        type: 'transformedDeflistGroupName',
                        data: { hName: 'div', hProperties: { className: 'group-name' } },
                        children: dt.children,
                    }, {
                        type: 'transformedDeflistContent',
                        data: { hName: 'div', hProperties: { className: 'group-content' } },
                        children: dd.length > 1 ? dd.map(({ children }) => ({
                            type: 'transformedDeflistContentItem',
                            data: { hName: 'div', hProperties: { className: 'group-content-item' } },
                            children,
                        })) : dd[0]?.children ?? [],
                    }],
                })),
            };
            // replace deflist with transformed node
            parent.children.splice(idx, 1, transformed);
        });
    };
}