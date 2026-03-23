/**
 * GitHub Discussion → Confluence sync direction.
 *
 * Triggered by `discussion_comment` webhook events. Takes a single
 * Discussion comment, converts Markdown → Confluence storage format,
 * and creates/updates the corresponding Confluence page comment.
 *
 * @module comment-sync/github-to-confluence
 */
import logger from '../logger.js';
import { markdownToHtml } from './html-to-markdown.js';
import {
    extractGithubId,
    extractConfluenceId,
    extractChecksum,
    computeChecksum,
    stripMarkers,
    buildMarkers
} from './markers.js';

/**
 * Sync a single GitHub Discussion comment to Confluence.
 *
 * @param {object} opts
 * @param {import('../confluence-sdk.js').default} opts.confluenceSdk
 * @param {object} opts.comment - GitHub Discussion comment payload
 * @param {string} opts.comment.node_id - GraphQL node ID
 * @param {string} opts.comment.body - Markdown body
 * @param {number} opts.pageId - Target Confluence page ID
 * @returns {Promise<{action: 'created'|'updated'|'skipped', commentId?: string}>}
 */
export async function syncGithubCommentToConfluence({
    confluenceSdk,
    comment,
    pageId
}) {
    const ghCommentId = comment.node_id;
    const body = comment.body || '';

    // Loop prevention: if this comment originated from Confluence, skip it
    if (extractConfluenceId(body)) {
        logger.debug(`[GH→C] Skipping comment ${ghCommentId} (originated from Confluence)`);
        return { action: 'skipped' };
    }

    const cleanBody = stripMarkers(body);
    const htmlBody = markdownToHtml(cleanBody);
    const bodyChecksum = computeChecksum(cleanBody);

    // Check if a matching Confluence comment already exists
    const existingComments = await confluenceSdk.getComments(pageId);

    for (const cComment of existingComments) {
        const storedHtml = cComment.body?.storage?.value || '';
        const linkedGhId = extractGithubId(storedHtml);

        if (linkedGhId === ghCommentId) {
            // Found existing mirror — check if content changed
            const existingChecksum = extractChecksum(storedHtml);
            if (existingChecksum === bodyChecksum) {
                logger.debug(`[GH→C] Comment ${ghCommentId} unchanged, skipping`);
                return { action: 'skipped' };
            }

            // Content changed — update
            const markers = buildMarkers('github', ghCommentId, bodyChecksum);
            const newHtml = `${htmlBody}\n${markers}`;
            await confluenceSdk.updateComment(
                Number(cComment.id),
                cComment.version.number,
                newHtml
            );
            logger.info(`[GH→C] Updated Confluence comment ${cComment.id} for GH comment ${ghCommentId}`);
            return { action: 'updated', commentId: cComment.id };
        }
    }

    // No existing mirror — create new Confluence comment
    const markers = buildMarkers('github', ghCommentId, bodyChecksum);
    const newHtml = `${htmlBody}\n${markers}`;
    const created = await confluenceSdk.createComment(pageId, newHtml);
    logger.info(`[GH→C] Created Confluence comment ${created.id} for GH comment ${ghCommentId}`);
    return { action: 'created', commentId: created.id };
}

/**
 * Batch sync: process all Discussion comments for mapped pages.
 * Used in the scheduled (poll) direction to catch comments that
 * might have been missed by webhook events.
 *
 * @param {object} opts
 * @param {import('../confluence-sdk.js').default} opts.confluenceSdk
 * @param {import('./github-client.js').default} opts.githubClient
 * @param {import('./mapping.js').default} opts.mapping
 * @param {Array<{pageId: number, pagePath: string}>} opts.pages
 * @returns {Promise<{created: number, updated: number, skipped: number}>}
 */
export async function batchSyncGithubToConfluence({
    confluenceSdk,
    githubClient,
    mapping,
    pages
}) {
    const stats = { created: 0, updated: 0, skipped: 0 };

    for (const { pageId, pagePath } of pages) {
        logger.info(`[GH→C] Syncing comments for page "${pagePath}" (id=${pageId})`);

        const discussion = await mapping.findDiscussion(pagePath);
        if (!discussion) {
            logger.debug(`[GH→C] No Discussion found for "${pagePath}", skipping`);
            continue;
        }

        const ghComments = await githubClient.getDiscussionComments(discussion.number);

        for (const ghComment of ghComments) {
            const result = await syncGithubCommentToConfluence({
                confluenceSdk,
                comment: { node_id: ghComment.id, body: ghComment.body },
                pageId
            });

            stats[result.action === 'created' ? 'created'
                : result.action === 'updated' ? 'updated'
                    : 'skipped']++;
        }
    }

    return stats;
}
