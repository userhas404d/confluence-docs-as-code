/**
 * @module pull/adf-nodes/emoji
 * @description ADF emoji handler — outputs Unicode character or shortName fallback.
 */
import { registerHandler } from './index.js';

/**
 * Handler for emoji nodes.
 * Outputs Unicode character from attrs.text, falls back to :shortName:.
 */
registerHandler('emoji', (node) => {
    if (!node.attrs) return '';
    return node.attrs.text || node.attrs.shortName || '';
});
