import type { Transformer } from 'unified';
import type { Heading, Text, PhrasingContent } from 'mdast';
import { visit } from 'unist-util-visit';

interface TypeData {
    nodes: PhrasingContent[]
    required: boolean
}

export function pre(): Transformer {
    return async (root) => {
        visit(root, 'heading', (headingNode: Heading) => {
            headingNode.data ||= {};
            // search for type split
            const index = headingNode.children.findIndex((child) => child.type === 'text' && child.value.includes('«'));
            // stop if type syntax is not found
            if (index < 0) return;
            // search for ending type split
            const endIndex = headingNode.children.findIndex((child) => child.type === 'text' && child.value.includes('»'));
            // if end index is not found, syntax is malformed
            if (endIndex < index) return;
            // extract data type
            if (index === endIndex) {
                // type annotation is all within the same node
                const splitNode = headingNode.children[index] as Text,
                    match = /\s*«(!)?([^»]*)»/.exec(splitNode.value)!;
                // set hProperties field
                headingNode.data.hProperties ||= {};
                headingNode.data.hProperties.typeData = match[2]!;
                headingNode.data.hProperties.required = !!match[1];
                // remove match text
                splitNode.value = splitNode.value.slice(0, match.index)
                    + splitNode.value.slice(match.index + match[0].length);
                // delete split node if it is now an empty string
                if (!splitNode.value) headingNode.children.splice(index, 1);
            } else {
                // node containing the opening '«'
                const startNode = headingNode.children[index] as Text,
                    // node containing the closing '»'
                    endNode = headingNode.children[endIndex] as Text,
                    // first bit of the data type text
                    startMatch = /\s*«(!)?(.*)$/.exec(startNode.value)!,
                    // last bit of the data type text
                    endMatch = /^(.*?)»/.exec(endNode.value)!;
                // remove the first bit of the data type text from the node containing the opening '«'
                startNode.value = startNode.value.slice(0, startMatch.index);
                // remove the last bit of the data type text from the node containing the closing '»'
                endNode.value = endNode.value.slice(endMatch[0].length);
                // remove all nodes between the opening '«' node and the closing '»' node
                const typeNodes = headingNode.children.splice(index + 1, endIndex - index - 1);
                // add first bit of the data type text to the data type nodes array
                if (startMatch[2]) typeNodes.unshift({ type: 'text', value: startMatch[2] });
                // add last bit of the data type text to the data type nodes array
                if (endMatch[1]) typeNodes.push({ type: 'text', value: endMatch[1] });
                // remove node containing the closing '»' if it is now empty
                if (!endNode.value) headingNode.children.splice(index + 1, 1);
                // remove node containing the opening '«' if it is now empty
                if (!startNode.value) headingNode.children.splice(index, 1);
                // set typeData field
                (headingNode.data as { typeData: TypeData }).typeData = {
                    nodes: typeNodes,
                    required: !!startMatch[1],
                };
            }
        });
    };
}

export function post(): Transformer {
    return async (root) => {
        visit(root, 'heading', (headingNode: Heading) => {
            if (!(headingNode.data as { typeData?: TypeData })?.typeData) return;
            // remove the typeData field from the headingNode's data object
            const { typeData: { nodes, required }, ...data } = (headingNode.data as { typeData: TypeData });
            headingNode.data = data;
            // add a mdxHeaderTypeData node
            const complexTypeNode = {
                type: 'mdxHeaderTypeData',
                data: {
                    hName: 'mdxHeaderTypeData',
                    hProperties: { required },
                },
                children: nodes,
            };
            // @ts-expect-error: invented node type
            headingNode.children.unshift(complexTypeNode);
        });
    };
}