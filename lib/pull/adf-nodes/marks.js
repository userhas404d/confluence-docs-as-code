/**
 * @module pull/adf-nodes/marks
 * @description Handles text marks: strong, em, code, link, strike.
 * Also processes the 'text' node type.
 */
import { registerHandler } from './index.js';

/**
 * Apply marks to a text string.
 *
 * @param {string} text - Raw text content
 * @param {Array<object>} marks - Array of ADF mark objects
 * @param {object} context - ConversionContext
 * @returns {string} Marked-up Markdown text
 */
export function applyMarks(text, marks, context) {
    if (!marks || marks.length === 0) {
        return text;
    }

    let result = text;
    for (const mark of marks) {
        switch (mark.type) {
            case 'strong':
                result = `**${result}**`;
                break;
            case 'em':
                result = `*${result}*`;
                break;
            case 'code':
                result = `\`${result}\``;
                break;
            case 'link': {
                const href = mark.attrs?.href || '';
                // Attempt to resolve Confluence URLs via pageSlugMap
                const resolved = resolveLink(href, context);
                // If the link was resolved to an internal path and the display
                // text looks like a URL, replace with the page title
                let displayText = result;
                if (resolved !== href && looksLikeUrl(displayText)) {
                    const title = findTitleForHref(href, context);
                    if (title) {
                        displayText = title;
                    }
                }
                result = `[${displayText}](${resolved})`;
                break;
            }
            case 'strike':
                result = `~~${result}~~`;
                break;
            case 'textColor':
            case 'alignment':
            case 'breakout':
            case 'indentation':
            case 'annotation':
            case 'inlineComment':
            // Non-portable marks — strip without artifacts
                break;
            default:
            // Unknown mark — pass through
                break;
        }
    }

    return result;
}

/**
 * Check if text looks like a URL (has domain-like pattern).
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if text looks like a URL
 */
function looksLikeUrl(text) {
    return /^https?:\/\//.test(text) || /^[a-z0-9-]+\.[a-z0-9-]+\./.test(text) ||
        /atlassian\.net/.test(text);
}

/**
 * Find the page title for a Confluence URL href using pageTitleMap.
 *
 * @param {string} href - Confluence URL
 * @param {object} context - ConversionContext with pageTitleMap
 * @returns {string|null} Page title or null
 */
function findTitleForHref(href, context) {
    if (!context?.pageTitleMap || context.pageTitleMap.size === 0) {
        return null;
    }
    const patterns = [
        /\/wiki\/spaces\/[^/]+\/pages\/(\d+)/,
        /\/pages\/(\d+)/
    ];
    for (const pattern of patterns) {
        const match = href.match(pattern);
        if (match) {
            return context.pageTitleMap.get(match[1]) || null;
        }
    }
    return null;
}

/**
 * Resolve a link href, checking if it's an internal Confluence URL.
 * Returns a path relative to the current page's directory.
 *
 * @param {string} href - Original href
 * @param {object} context - ConversionContext with pageSlugMap and currentOutputPath
 * @returns {string} Resolved href (relative .md path or original)
 */
function resolveLink(href, context) {
    if (!context || !context.pageSlugMap || context.pageSlugMap.size === 0) {
        return href;
    }

    // Try to extract page ID from Confluence URL patterns
    const patterns = [
        /\/wiki\/spaces\/[^/]+\/pages\/(\d+)/,
        /\/pages\/(\d+)/
    ];

    for (const pattern of patterns) {
        const match = href.match(pattern);
        if (match) {
            const pageId = match[1];
            const resolved = context.pageSlugMap.get(pageId);
            if (resolved) {
                return relativizePath(resolved, context.currentOutputPath);
            }
        }
    }

    return href;
}

/**
 * Make a docs-relative path relative to the current page's location.
 *
 * @param {string} targetPath - Path relative to docs/ root
 * @param {string} currentOutputPath - Current page's outputPath
 * @returns {string} Relative path from current page to target
 */
function relativizePath(targetPath, currentOutputPath) {
    if (!currentOutputPath || !targetPath) return targetPath;
    if (/^https?:\/\//.test(targetPath) || targetPath.startsWith('#')) {
        return targetPath;
    }

    const currentDir = currentOutputPath.includes('/')
        ? currentOutputPath.substring(0, currentOutputPath.lastIndexOf('/'))
        : '';

    if (!currentDir) return targetPath;

    const targetDir = targetPath.includes('/')
        ? targetPath.substring(0, targetPath.lastIndexOf('/'))
        : '';
    const targetFile = targetPath.includes('/')
        ? targetPath.substring(targetPath.lastIndexOf('/') + 1)
        : targetPath;

    if (targetDir === currentDir) return targetFile;

    const currentParts = currentDir.split('/');
    const targetParts = targetDir ? targetDir.split('/') : [];

    let common = 0;
    while (common < currentParts.length && common < targetParts.length
        && currentParts[common] === targetParts[common]) {
        common++;
    }

    const ups = currentParts.length - common;
    const downs = targetParts.slice(common);
    const segments = [];
    for (let i = 0; i < ups; i++) segments.push('..');
    segments.push(...downs);
    segments.push(targetFile);

    return segments.join('/');
}

// Register text handler — processes text with marks
registerHandler('text', (node, context) => {
    const text = node.text || '';
    return applyMarks(text, node.marks, context);
});
