/**
 * @module pull/adf-nodes/layout
 * @description ADF layout handlers — flattens multi-column layouts into sequential blocks.
 */
import { registerHandler, convertChildren } from './index.js';

/**
 * Handler for layoutSection — flattens columns into sequential content.
 * Adds HTML comment noting original column count.
 */
registerHandler('layoutSection', (node, context) => {
    const columns = (node.content || []).filter(c => c.type === 'layoutColumn');
    const columnCount = columns.length;

    const comment = `<!-- Original layout had ${columnCount} columns -->\n`;
    const content = convertChildren(node.content || [], context);

    return comment + content;
});

/**
 * Handler for layoutColumn — outputs column content as sequential blocks.
 */
registerHandler('layoutColumn', (node, context) => {
    return convertChildren(node.content || [], context);
});
