import type { Transformer } from 'unified';
import type { MdxJsxTextElement } from 'mdast-util-mdx-jsx';
import { visit } from 'unist-util-visit';

export default function plugin(): Transformer {
    return async (root) => {
        visit(root, 'mdxJsxTextElement', (node: MdxJsxTextElement) => {
            if (node.name !== 'kbd') return;
            node.name = 'KBD';
        });
    };
}