/**
 * @module pull/adf-nodes/mention
 * @description ADF mention handler — outputs @Display Name plain text.
 */
import { registerHandler } from './index.js';

/**
 * Handler for mention nodes.
 * Outputs @Display Name from attrs.text.
 */
registerHandler('mention', (node) => {
    const text = node.attrs?.text || 'unknown';
    return `@${text}`;
});
