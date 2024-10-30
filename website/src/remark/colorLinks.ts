import type { Transformer } from 'unified';
import type { Node, Parent, Link } from 'mdast';
import { visit } from 'unist-util-visit';

function stringify(node: Node | Node[]): string {
    if ('value' in node) {
        const { value } = node as { value: unknown };
        return typeof value === 'string' ? value : '';
    }
    if (Array.isArray(node)) return node.map(stringify).join('');
    if ('children' in node) return (node as Parent).children.map(stringify).join('');
    return '';
}

export default function plugin(): Transformer {
    return async (root) => {
        visit(root, 'link', (node: Link) => {
            if (!node.url?.startsWith('color:')) return;
            // extract color info portion of the link
            const color = node.url.replace(/^color:/, '');
            // wipe the link node, but save its child nodes
            for (const key of Object.keys(node)) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                if (key !== 'children') delete node[key];
            }
            // transform into a color preview node
            (node as { type: string }).type = 'colorPreview';
            node.data = {
                hName: 'ColorPreview',
                hProperties: { color },
            };
            // convert children to text
            node.children = [{ type: 'text', value: stringify(node.children) }];
        });
    };
}