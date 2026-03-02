/**
 * @module pull/link-resolver
 * @description Resolves Confluence page URLs to relative Markdown file paths
 * using a pageSlugMap built from the page tree.
 */

/**
 * Regex to extract page ID from Confluence URLs.
 * Matches: /wiki/spaces/{spaceKey}/pages/{pageId}/{optionalTitle}
 * @type {RegExp}
 */
const CONFLUENCE_PAGE_URL_PATTERN = /\/wiki\/spaces\/[^/]+\/pages\/(\d+)(?:\/|$)/;

/**
 * Build a page slug map from a PageTreeNode tree.
 * Maps Confluence page ID → relative Markdown file path.
 *
 * @param {object} tree - Root PageTreeNode
 * @returns {Map<string, string>} pageId → relative .md path
 */
export function buildPageSlugMap(tree) {
    const map = new Map();
    collectPaths(tree, map);
    return map;
}

/**
 * Recursively collect page ID → output path mappings.
 *
 * @param {object} node - PageTreeNode
 * @param {Map<string, string>} map - Map to populate
 */
function collectPaths(node, map) {
    map.set(node.id, node.outputPath);
    for (const child of node.children) {
        collectPaths(child, map);
    }
}

/**
 * Build a page title map from a PageTreeNode tree.
 * Maps Confluence page ID → page title.
 *
 * @param {object} tree - Root PageTreeNode
 * @returns {Map<string, string>} pageId → title
 */
export function buildPageTitleMap(tree) {
    const map = new Map();
    collectTitles(tree, map);
    return map;
}

/**
 * Recursively collect page ID → title mappings.
 *
 * @param {object} node - PageTreeNode
 * @param {Map<string, string>} map - Map to populate
 */
function collectTitles(node, map) {
    map.set(node.id, node.title);
    for (const child of node.children) {
        collectTitles(child, map);
    }
}

/**
 * Extract a Confluence page ID from a URL.
 *
 * @param {string} url - URL to parse
 * @returns {string|null} Extracted page ID or null if not a Confluence page URL
 */
export function extractPageIdFromUrl(url) {
    const match = url.match(CONFLUENCE_PAGE_URL_PATTERN);
    return match ? match[1] : null;
}

/**
 * Extract a human-readable title from a Confluence URL.
 *
 * @param {string} url - Confluence URL
 * @returns {string} Title derived from URL or the URL itself
 */
export function extractTitleFromUrl(url) {
    // Try to extract title from URL path (last segment after page ID)
    const match = url.match(/\/pages\/\d+\/([^/?#]+)/);
    if (match) {
        return decodeURIComponent(match[1].replace(/\+/g, ' '));
    }

    // Fallback: use domain or full URL
    try {
        const parsed = new URL(url);
        return parsed.hostname + parsed.pathname;
    } catch {
        return url;
    }
}

/**
 * Resolve a URL to a relative Markdown path if it's an internal Confluence link.
 *
 * @param {string} url - URL to resolve
 * @param {Map<string, string>} pageSlugMap - Page ID → relative .md path map
 * @returns {string} Resolved relative path or original URL
 */
export function resolveLink(url, pageSlugMap) {
    const pageId = extractPageIdFromUrl(url);
    if (pageId && pageSlugMap.has(pageId)) {
        return pageSlugMap.get(pageId);
    }
    return url;
}

/**
 * Make a docs-relative path relative to the current page's location.
 *
 * Both `targetPath` and `currentOutputPath` are relative to the docs/ root.
 * For example, if the current page is at `teleport-and-aws/index.md` and the
 * target is `teleport-and-awsdatabase-access.md`, the result is
 * `../teleport-and-awsdatabase-access.md`.
 *
 * @param {string} targetPath - Path relative to docs/ root
 * @param {string} currentOutputPath - Current page's outputPath (relative to docs/)
 * @returns {string} Relative path from current page's directory to target
 */
export function relativize(targetPath, currentOutputPath) {
    if (!currentOutputPath || !targetPath) return targetPath;

    // Don't relativize absolute URLs or anchors
    if (/^https?:\/\//.test(targetPath) || targetPath.startsWith('#')) {
        return targetPath;
    }

    const currentDir = currentOutputPath.includes('/')
        ? currentOutputPath.substring(0, currentOutputPath.lastIndexOf('/'))
        : '';

    // If current page is at the docs root, no adjustment needed
    if (!currentDir) return targetPath;

    const targetDir = targetPath.includes('/')
        ? targetPath.substring(0, targetPath.lastIndexOf('/'))
        : '';
    const targetFile = targetPath.includes('/')
        ? targetPath.substring(targetPath.lastIndexOf('/') + 1)
        : targetPath;

    // If target is in the same directory, use just the filename
    if (targetDir === currentDir) {
        return targetFile;
    }

    // Count how many levels up we need to go from currentDir
    const currentParts = currentDir.split('/');
    const targetParts = targetDir ? targetDir.split('/') : [];

    // Find common prefix length
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
