import remarkDeflist from 'remark-deflist';
import type { Parent } from 'unist';
import type { Transformer } from 'unified';
import { visit } from 'unist-util-visit';

const deflist = remarkDeflist();

export default function plugin(): Transformer {
    return async (root, ...args) => {
        // run wrapped `remark-deflist` plugin
        deflist(root, ...args);
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
            // transform deflist into custom options-reference element
            const transformed: Parent = {
                type: 'optionsReference',
                data: { hName: 'div', hProperties: { className: 'options-reference' } },
                children: defs.map(({ dt, dd }) => ({
                    type: 'optionsReferenceCategory',
                    data: { hName: 'div', hProperties: { className: 'category' } },
                    children: [{
                        type: 'optionsReferenceCategoryName',
                        data: { hName: 'div', hProperties: { className: 'category-name' } },
                        children: dt.children,
                    }, {
                        type: 'optionsReferenceContent',
                        data: { hName: 'div', hProperties: { className: 'category-content' } },
                        children: dd.length > 1 ? dd.map(({ children }) => ({
                            type: 'optionsReferenceContentItem',
                            data: { hName: 'div', hProperties: { className: 'category-content-item' } },
                            children,
                        })) : dd[0]?.children ?? [],
                    }],
                })),
            };
            // replace deflist with transformed options reference node
            parent.children.splice(idx, 1, transformed);
        });
    };
}