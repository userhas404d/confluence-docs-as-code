/**
 * @module pull/adf-nodes
 * @description Registry of ADF node type handlers.
 * Each handler is a function: (node, context) → string
 */

/**
 * @typedef {Object} ConversionContext
 * @property {string} pageId - Current page's Confluence ID
 * @property {string} pageTitle - Current page's title
 * @property {Map<string, string>} attachmentMap - Maps fileId → local image path
 * @property {Map<string, string>} pageSlugMap - Maps pageId → relative .md path
 * @property {number} depth - Current nesting depth (for list indentation)
 * @property {string|null} listType - 'bullet' | 'ordered' | null
 * @property {number} listItemIndex - Current 1-based index in ordered list
 * @property {number} tableColumnCount - Columns in current table
 * @property {boolean} inlineMode - Whether processing inline content
 */

/** @type {Map<string, function>} */
const handlers = new Map();

/**
 * Register a handler for an ADF node type.
 *
 * @param {string} type - ADF node type name
 * @param {function} handler - Handler function (node, context) → string
 */
export function registerHandler(type, handler) {
    handlers.set(type, handler);
}

/**
 * Extension macro types that should be silently skipped (no output).
 * These are Confluence-specific macros with no meaningful Markdown equivalent.
 * @type {Set<string>}
 */
const SKIPPED_EXTENSION_MACROS = new Set([
    'toc', 'children', 'pagetree', 'excerpt', 'recently-updated',
    'jira', 'include', 'multiexcerpt', 'panel-highlight'
]);

/**
 * Convert a single ADF node to Markdown using the registered handler.
 * Falls back to processing children for unknown container nodes,
 * or returns an HTML comment for unknown leaf nodes.
 *
 * @param {object} node - ADF node
 * @param {ConversionContext} context - Conversion context
 * @returns {string} Markdown fragment
 */
export function convertNode(node, context) {
    if (!node || !node.type) {
        return '';
    }

    // Silently skip known non-portable extension macros
    if ((node.type === 'extension' || node.type === 'bodiedExtension' || node.type === 'inlineExtension') &&
        node.attrs?.extensionKey &&
        SKIPPED_EXTENSION_MACROS.has(node.attrs.extensionKey)) {
        return '';
    }

    const handler = handlers.get(node.type);
    if (handler) {
        return handler(node, context);
    }

    // Unknown node type — try to process children as fallback
    if (node.content && Array.isArray(node.content)) {
        return node.content.map(child => convertNode(child, context)).join('');
    }

    // Unknown leaf node — emit HTML comment
    return `<!-- Unknown ADF node: ${node.type} -->\n`;
}

/**
 * Convert an array of child nodes (inline content) to a Markdown string.
 * Handles text nodes with marks.
 *
 * @param {object[]} content - Array of ADF child nodes
 * @param {ConversionContext} context - Conversion context
 * @returns {string} Concatenated Markdown
 */
export function convertChildren(content, context) {
    if (!content || !Array.isArray(content)) {
        return '';
    }
    return content.map(child => convertNode(child, context)).join('');
}

export { handlers };
