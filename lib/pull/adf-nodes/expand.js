/**
 * @module pull/adf-nodes/expand
 * @description ADF expand handler — converts to MkDocs Material collapsible admonitions.
 */
import { registerHandler, convertChildren } from './index.js';

/**
 * Map Confluence panelType to MkDocs admonition keyword (for panel-wrapped expands).
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
 * Handler for expand nodes.
 * Outputs MkDocs collapsible admonition with `???` syntax.
 *
 * - Plain expand → `??? note "title"`
 * - Expand wrapping a panel → `??? panelType "title"`
 *
 * @param {object} node - ADF expand node
 * @param {object} context - Conversion context
 * @returns {string} MkDocs collapsible admonition block
 */
registerHandler('expand', (node, context) => {
    const title = node.attrs?.title || 'Details';
    const content = node.content || [];

    // Check if expand wraps a panel (first child is panel)
    let admonitionType = 'note';
    let innerContent = content;

    if (content.length > 0 && content[0].type === 'panel') {
        const panelType = content[0].attrs?.panelType || 'note';
        admonitionType = PANEL_TYPE_MAP[panelType] || 'note';
        // Use panel's inner content + any remaining siblings
        innerContent = [
            ...(content[0].content || []),
            ...content.slice(1)
        ];
    }

    // Convert children content
    const childContent = convertChildren(innerContent, context);

    // Indent all content lines with 4 spaces
    const indented = childContent
        .split('\n')
        .map(line => line.length > 0 ? `    ${line}` : '')
        .join('\n');

    return `??? ${admonitionType} "${title}"\n${indented}\n`;
});
