/**
 * @module pull/adf-nodes/inline-card
 * @description ADF inline card handler — converts smart links/embeds to Markdown links.
 */
import { registerHandler } from './index.js';
import { resolveLink, relativize, extractPageIdFromUrl, extractTitleFromUrl } from '../link-resolver.js';

/**
 * Convert a card node (inlineCard or embedCard) to a Markdown link.
 *
 * @param {object} node - ADF card node
 * @param {object} context - Conversion context with pageSlugMap and pageTitleMap
 * @returns {string} Markdown link
 */
function convertCard(node, context) {
    const url = node.attrs?.url || '';
    const pageSlugMap = context.pageSlugMap || new Map();
    const pageTitleMap = context.pageTitleMap || new Map();
    let resolvedUrl = resolveLink(url, pageSlugMap);

    // Make the resolved path relative to the current page's location
    if (resolvedUrl !== url) {
        resolvedUrl = relativize(resolvedUrl, context.currentOutputPath);
    }

    // Prefer the real page title from pageTitleMap when available
    const pageId = extractPageIdFromUrl(url);
    const title = (pageId && pageTitleMap.has(pageId))
        ? pageTitleMap.get(pageId)
        : extractTitleFromUrl(url);

    return `[${title}](${resolvedUrl})`;
}

/**
 * Handler for inlineCard — Confluence smart link.
 */
registerHandler('inlineCard', (node, context) => {
    return convertCard(node, context);
});

/**
 * Handler for embedCard — Confluence embed link.
 */
registerHandler('embedCard', (node, context) => {
    return convertCard(node, context);
});
