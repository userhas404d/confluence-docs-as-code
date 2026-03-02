/**
 * @module pull/adf-nodes/code-block
 * @description ADF code block handler — converts to fenced Markdown code blocks.
 */
import { registerHandler } from './index.js';

/**
 * Handler for codeBlock nodes.
 * Outputs fenced code block with optional language.
 *
 * @param {object} node - ADF codeBlock node
 * @param {object} context - Conversion context
 * @returns {string} Markdown fenced code block
 */
registerHandler('codeBlock', (node) => {
    const language = node.attrs?.language || '';
    const text = (node.content || [])
        .filter(child => child.type === 'text')
        .map(child => child.text)
        .join('');

    return `\`\`\`${language}\n${text}\n\`\`\`\n`;
});
