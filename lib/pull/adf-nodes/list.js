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

    const parts = [];
    for (const child of (node.content || [])) {
        if (child.type === 'bulletList' || child.type === 'orderedList') {
            // Nested list — increase depth
            context.depth++;
            parts.push(convertNode(child, context));
        } else {
            // paragraph or other inline content
            const text = convertChildren(child.content, context);
            parts.push(`${indent}${marker}${text}\n`);
        }
    }

    return parts.join('');
});
