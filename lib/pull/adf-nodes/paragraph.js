/**
 * @module pull/adf-nodes/paragraph
 * @description Handles paragraph, heading, blockquote, hardBreak, and rule nodes.
 */
import { registerHandler, convertChildren } from './index.js';

// paragraph → text + newline
registerHandler('paragraph', (node, context) => {
    const text = convertChildren(node.content, context);
    return text + '\n';
});

// heading → # based on level
registerHandler('heading', (node, context) => {
    const level = node.attrs?.level || 1;
    const prefix = '#'.repeat(level);
    const text = convertChildren(node.content, context);
    return `${prefix} ${text}\n`;
});

// blockquote → > prefixed lines
registerHandler('blockquote', (node, context) => {
    const inner = convertChildren(node.content, context);
    const lines = inner.split('\n').filter(l => l.length > 0);
    return lines.map(line => `> ${line}`).join('\n') + '\n';
});

// hardBreak → trailing spaces + newline (Markdown line break)
registerHandler('hardBreak', () => {
    return '  \n';
});

// rule → horizontal rule
registerHandler('rule', () => {
    return '---\n';
});
