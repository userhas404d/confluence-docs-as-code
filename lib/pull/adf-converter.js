/**
 * @module pull/adf-converter
 * @description ADF (Atlassian Document Format) to Markdown converter engine.
 * Uses a visitor-pattern dispatch to registered node handlers.
 */
import { convertNode } from './adf-nodes/index.js';

/**
 * @typedef {import('./adf-nodes/index.js').ConversionContext} ConversionContext
 */

/**
 * Create a new ConversionContext with defaults.
 *
 * @param {object} overrides - Properties to override
 * @returns {ConversionContext} A fresh conversion context
 */
export function createContext(overrides = {}) {
    return {
        pageId: '',
        pageTitle: '',
        currentOutputPath: '',
        attachmentMap: new Map(),
        pageSlugMap: new Map(),
        pageTitleMap: new Map(),
        depth: 0,
        listType: null,
        listItemIndex: 0,
        tableColumnCount: 0,
        inlineMode: false,
        ...overrides
    };
}

/**
 * Convert an ADF document to Markdown.
 *
 * @param {object|string} adf - ADF document (object or JSON string)
 * @param {ConversionContext} context - Conversion context
 * @returns {string} Markdown string
 */
export function convertAdf(adf, context) {
    let doc;
    try {
        doc = typeof adf === 'string' ? JSON.parse(adf) : adf;
    } catch {
        // ADF parse failure → output raw JSON as code block
        const raw = typeof adf === 'string' ? adf : JSON.stringify(adf, null, 2);
        return '```json\n' + raw + '\n```\n';
    }

    if (!doc || !doc.content || !Array.isArray(doc.content)) {
        // Empty page — title-only output
        return '';
    }

    const parts = [];
    for (const node of doc.content) {
        const result = convertNode(node, context);
        if (result !== undefined && result !== null) {
            parts.push(result);
        }
    }

    return parts.join('\n');
}
