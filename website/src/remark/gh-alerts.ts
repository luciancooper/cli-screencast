import type { Blockquote } from 'mdast';

// these are the only keywords github supports. see:
// https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts
const keywords = [
    'note',
    'tip',
    'important',
    'warning',
    'caution',
];

export default function plugin() {
    return async (root) => {
        const { visit } = await import('unist-util-visit');
        visit(root, 'blockquote', (node: Blockquote) => {
            if (node.children[0]?.type !== 'paragraph' || node.children[0].children[0].type !== 'text') return;
            // match github alert syntax in first text child
            const textNode = node.children[0].children[0],
                match = /^\[!(\w+)\]\n/.exec(textNode.value);
            // stop if no syntax match was found
            if (!match || !keywords.includes(match[1]?.toLowerCase())) return;
            // remove matched syntax string from text node
            textNode.value = textNode.value.slice(match[0].length);
            // remove text node if it is now empty
            if (!textNode.value) node.children[0].children.splice(0, 1);
            // get the alert type
            const type = match[1].toLowerCase();
            // transform into an admonition node
            node.data = {
                hName: 'admonition',
                hProperties: {
                    // convert from github alert type to docusaurus admonition type
                    type: type === 'caution' ? 'danger' : type,
                    // github alert type should be the title text
                    title: type,
                },
            };
        });
    };
}