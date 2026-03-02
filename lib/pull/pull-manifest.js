/**
 * @module pull/pull-manifest
 * @description Manages the pull manifest for incremental sync.
 * Tracks page version numbers and attachment metadata so subsequent pulls
 * can skip unchanged content, saving API calls and bandwidth.
 *
 * The manifest file (.pull-manifest.json) is written to the output directory
 * alongside docs/ and mkdocs.yml.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Manifest file name — written to the root of the output directory.
 * @type {string}
 */
export const MANIFEST_FILENAME = '.pull-manifest.json';

/**
 * @typedef {Object} ManifestPageEntry
 * @property {string} pageId - Confluence page ID
 * @property {string} title - Page title at time of pull
 * @property {number} version - Confluence page version number
 * @property {string} outputPath - Relative path from docs/ (e.g. "getting-started.md")
 * @property {string[]} attachments - List of local image filenames downloaded for this page
 */

/**
 * @typedef {Object} PullManifest
 * @property {number} schemaVersion - Manifest format version (currently 1)
 * @property {string} rootPageId - Confluence root page ID this manifest was built from
 * @property {string} pulledAt - ISO 8601 timestamp of last pull
 * @property {Object<string, ManifestPageEntry>} pages - Map of pageId → entry
 */

/**
 * Load an existing manifest from the output directory.
 *
 * @param {string} outputDir - Absolute path to the output directory
 * @returns {PullManifest|null} Parsed manifest, or null if none exists or is invalid
 */
export function loadManifest(outputDir) {
    const manifestPath = path.join(outputDir, MANIFEST_FILENAME);
    try {
        if (!fs.existsSync(manifestPath)) {
            return null;
        }
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw);

        // Basic validation
        if (!manifest || typeof manifest !== 'object' || manifest.schemaVersion !== 1) {
            return null;
        }
        return manifest;
    } catch {
        return null;
    }
}

/**
 * Save a manifest to the output directory.
 *
 * @param {string} outputDir - Absolute path to the output directory
 * @param {PullManifest} manifest - Manifest object to write
 */
export function saveManifest(outputDir, manifest) {
    const manifestPath = path.join(outputDir, MANIFEST_FILENAME);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Create a fresh empty manifest.
 *
 * @param {string} rootPageId - Confluence root page ID
 * @returns {PullManifest}
 */
export function createManifest(rootPageId) {
    return {
        schemaVersion: 1,
        rootPageId,
        pulledAt: new Date().toISOString(),
        pages: {}
    };
}

/**
 * Determine whether a page needs to be re-fetched based on the manifest.
 *
 * A page is considered changed (needs re-fetch) if:
 * - No manifest exists (force === true semantically)
 * - The page is not in the manifest
 * - The page's version number has increased
 * - The page's title has changed (may affect slug/path)
 *
 * @param {PullManifest|null} manifest - Previously loaded manifest (or null)
 * @param {string} pageId - Confluence page ID
 * @param {number} version - Current page version number from the API
 * @param {string} title - Current page title
 * @returns {boolean} True if the page content should be re-processed
 */
export function isPageChanged(manifest, pageId, version, title) {
    if (!manifest) return true;
    const entry = manifest.pages[pageId];
    if (!entry) return true;
    if (version > entry.version) return true;
    if (title !== entry.title) return true;
    return false;
}

/**
 * Build a manifest page entry for a processed page.
 *
 * @param {string} pageId - Confluence page ID
 * @param {string} title - Page title
 * @param {number} version - Page version number
 * @param {string} outputPath - Relative output path from docs/
 * @param {string[]} attachments - Downloaded attachment filenames
 * @returns {ManifestPageEntry}
 */
export function buildPageEntry(pageId, title, version, outputPath, attachments) {
    return { pageId, title, version, outputPath, attachments };
}

/**
 * Find pages that were in the old manifest but are no longer in the page tree.
 * These represent deleted or moved pages whose output files should be removed.
 *
 * @param {PullManifest|null} oldManifest - Previous manifest
 * @param {Set<string>} currentPageIds - Set of page IDs discovered in the current tree walk
 * @returns {ManifestPageEntry[]} Entries for pages that should be cleaned up
 */
export function findRemovedPages(oldManifest, currentPageIds) {
    if (!oldManifest) return [];
    return Object.values(oldManifest.pages)
        .filter(entry => !currentPageIds.has(entry.pageId));
}
