/**
 * @module pull/adf-nodes/list
 * @description Handles bulletList, orderedList, and listItem nodes.
 */
import { registerHandler, convertNode, convertChildren } from './index.js';

// bulletList
registerHandler('bulletList', (node, context) => {
    const prevListType = context.listType;
    const prevDepth = context.depth;
    context.listType = 'bullet';

    const items = [];
    for (const child of (node.content || [])) {
        items.push(convertNode(child, context));
    }

    context.listType = prevListType;
    context.depth = prevDepth;
    return items.join('');
});

// orderedList
registerHandler('orderedList', (node, context) => {
    const prevListType = context.listType;
    const prevDepth = context.depth;
    context.listType = 'ordered';
    context.listItemIndex = 0;

    const items = [];
    for (const child of (node.content || [])) {
        items.push(convertNode(child, context));
    }

    context.listType = prevListType;
    context.depth = prevDepth;
    return items.join('');
});

// listItem
registerHandler('listItem', (node, context) => {
    const indent = '    '.repeat(context.depth);
    const marker = context.listType === 'ordered' ? '1. ' : '- ';
    // Continuation lines inside a list item must be indented to align
    // with the content after the marker (indent + marker width).
    const continuationIndent = indent + '    ';

    const parts = [];
    const children = node.content || [];
    for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (child.type === 'bulletList' || child.type === 'orderedList') {
            // Nested list — increase depth
            context.depth++;
            parts.push(convertNode(child, context));
        } else if (i === 0) {
            // First child gets the list marker
            const text = convertChildren(child.content, context);
            parts.push(`${indent}${marker}${text}\n`);
        } else {
            // Subsequent children are continuation content — indent without marker.
            // Use the full convertNode so codeBlock, mediaSingle etc. render properly.
            const prevListIndent = context.listIndent;
            context.listIndent = continuationIndent;
            const rendered = convertNode(child, context);
            context.listIndent = prevListIndent;

            if (child.type === 'codeBlock') {
                // Indent every line of the fenced code block
                const indented = rendered
                    .split('\n')
                    .map(line => line === '' ? '' : continuationIndent + line)
                    .join('\n');
                parts.push(indented);
            } else if (child.type === 'mediaSingle' || child.type === 'media') {
                // Indent image embed
                const indented = rendered
                    .split('\n')
                    .map(line => line === '' ? '' : continuationIndent + line)
                    .join('\n');
                parts.push(indented);
            } else if (child.type === 'paragraph') {
                const text = convertChildren(child.content, context);
                if (text) {
                    parts.push(`${continuationIndent}${text}\n`);
                } else {
                    // Empty paragraph — blank continuation line
                    parts.push('\n');
                }
            } else {
                // Other block types — indent each line
                const indented = rendered
                    .split('\n')
                    .map(line => line === '' ? '' : continuationIndent + line)
                    .join('\n');
                parts.push(indented);
            }
        }
    }

    return parts.join('');
});
