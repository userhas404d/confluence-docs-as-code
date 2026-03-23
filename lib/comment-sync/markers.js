/**
 * HTML comment markers for deduplication and loop prevention.
 *
 * Confluence comments mirrored to GitHub get:
 *   <!-- confluence-comment-id:12345 -->
 *
 * GitHub Discussion comments mirrored to Confluence get:
 *   <!-- github-discussion-comment-id:MDEyOk... -->
 *
 * Body checksums detect edits since last sync:
 *   <!-- body-checksum:sha256hex -->
 *
 * @module comment-sync/markers
 */
import { createHash } from 'node:crypto';

const CONFLUENCE_RE = /<!--\s*confluence-comment-id:(\S+)\s*-->/;
const GITHUB_RE = /<!--\s*github-discussion-comment-id:(\S+)\s*-->/;
const CHECKSUM_RE = /<!--\s*body-checksum:([a-f0-9]+)\s*-->/;

/**
 * Extract a Confluence comment ID embedded in text.
 * @param {string} text
 * @returns {string|null}
 */
export function extractConfluenceId(text) {
    const m = text?.match(CONFLUENCE_RE);
    return m ? m[1] : null;
}

/**
 * Extract a GitHub Discussion comment ID embedded in text.
 * @param {string} text
 * @returns {string|null}
 */
export function extractGithubId(text) {
    const m = text?.match(GITHUB_RE);
    return m ? m[1] : null;
}

/**
 * Extract a body checksum embedded in text.
 * @param {string} text
 * @returns {string|null}
 */
export function extractChecksum(text) {
    const m = text?.match(CHECKSUM_RE);
    return m ? m[1] : null;
}

/**
 * Compute a SHA-256 checksum for comment body text.
 * Strips existing marker comments before hashing so the checksum
 * represents the meaningful content only.
 * @param {string} body
 * @returns {string} hex digest
 */
export function computeChecksum(body) {
    const clean = stripMarkers(body);
    return createHash('sha256').update(clean, 'utf8').digest('hex');
}

/**
 * Remove all marker HTML comments from text.
 * @param {string} text
 * @returns {string}
 */
export function stripMarkers(text) {
    return (text || '')
        .replace(CONFLUENCE_RE, '')
        .replace(GITHUB_RE, '')
        .replace(CHECKSUM_RE, '')
        .trim();
}

/**
 * Build the marker block to append to a mirrored comment body.
 *
 * @param {'confluence'|'github'} origin - Which system the comment originated in
 * @param {string} originId - The ID of the original comment
 * @param {string} bodyChecksum - Checksum of the content body
 * @returns {string} HTML comment markers
 */
export function buildMarkers(origin, originId, bodyChecksum) {
    const idTag = origin === 'confluence'
        ? `<!-- confluence-comment-id:${originId} -->`
        : `<!-- github-discussion-comment-id:${originId} -->`;
    return `${idTag}\n<!-- body-checksum:${bodyChecksum} -->`;
}
