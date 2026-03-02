/**
 * @module pull/adf-nodes/panel
 * @description ADF panel handler — converts to MkDocs Material admonitions.
 */
import { registerHandler, convertChildren } from './index.js';

/**
 * Map Confluence panelType to MkDocs admonition keyword.
 * @type {Object<string, string>}
 */
const PANEL_TYPE_MAP = {
    info: 'info',
    note: 'note',
    warning: 'warning',
    error: 'danger',
    success: 'success',
    tip: 'tip'
};

/**
 * Handler for panel nodes.
 * Outputs MkDocs admonition with 4-space indented content.
 *
 * @param {object} node - ADF panel node
 * @param {object} context - Conversion context
 * @returns {string} MkDocs admonition block
 */
registerHandler('panel', (node, context) => {
    const panelType = node.attrs?.panelType || 'note';
    const admonitionType = PANEL_TYPE_MAP[panelType] || 'note';

    // Convert children content
    const childContent = convertChildren(node.content || [], context);

    // Indent all content lines with 4 spaces
    const indented = childContent
        .split('\n')
        .map(line => line.length > 0 ? `    ${line}` : '')
        .join('\n');

    return `!!! ${admonitionType}\n${indented}\n`;
});
