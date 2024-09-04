import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

function firstChildOfType(node: Element, tagName: string): Element | null {
    return node.children.find((child) => (child.type === 'element' && child.tagName === tagName)) as Element | null;
}

function allChildrenOfType(node: Element, tagName: string): Element[] {
    return node.children.filter((child) => (child.type === 'element' && child.tagName === tagName)) as Element[];
}

export default function plugin() {
    return (tree: Root) => {
        visit(tree, 'element', (node) => {
            if (node.tagName !== 'table') return;
            // find thead node
            const thead = firstChildOfType(node, 'thead');
            if (!thead) return;
            // find first row of table header
            const tr = firstChildOfType(thead, 'tr');
            if (!tr) return;
            // find all header cells and look for '*' trailing syntax
            const cells = allChildrenOfType(tr, 'th'),
                grow: number[] = [];
            for (const th of cells) {
                // get last child of the header cell
                const last = th.children[th.children.length - 1];
                // check if last child is a text element that ends with '*'
                if (last?.type === 'text' && last.value.endsWith('*')) {
                    // remove '*' syntax from cell
                    last.value = last.value.slice(0, -1);
                    // if last node is now an empty text node, remove it
                    if (!last.value) th.children.pop();
                    // record column grow status
                    grow.push(1);
                } else {
                    // this column does not have an '*'
                    grow.push(0);
                }
            }
            // sum the number of grow columns found
            const count = grow.reduce((a, b) => a + b, 0);
            // stop if no table has no grow columns
            if (count === 0) return;
            // determine width percentage style value for each column
            const styles: (string | undefined)[] = count === grow.length
                // when every column is a grow column, they all must be width 0.1% so they all stretch
                ? new Array<string>(count).fill('width:0.1%;')
                // non grow columns will get 0.1% width so the others stretch
                : grow.map((a) => (!a ? 'width:0.1%;' : undefined));
            // set the style for each th node
            cells.forEach((th, i) => {
                if (styles[i]) th.properties.style = styles[i];
            });
        });
    };
}