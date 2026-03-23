/**
 * Confluence → GitHub Discussion sync direction.
 *
 * Polls Confluence for comments on mapped pages, converts HTML → Markdown,
 * and creates/updates corresponding Discussion comments. Handles resolved
 * and deleted Confluence comments via labels on the Discussion.
 *
 * @module comment-sync/confluence-to-github
 */
import logger from '../logger.js';
import { htmlToMarkdown } from './html-to-markdown.js';
import {
    extractConfluenceId,
    extractChecksum,
    computeChecksum,
    stripMarkers,
    buildMarkers
} from './markers.js';

/**
 * Sync comments from Confluence pages into GitHub Discussions.
 *
 * @param {object} opts
 * @param {import('../confluence-sdk.js').default} opts.confluenceSdk
 * @param {import('./github-client.js').default} opts.githubClient
 * @param {import('./mapping.js').default} opts.mapping
 * @param {Array<{pageId: number, pagePath: string}>} opts.pages - Pages to sync
 * @param {string} [opts.resolvedLabel='resolved'] - Label for resolved comments
 * @param {string} [opts.deletedLabel='deleted-on-confluence'] - Label for deleted comments
 * @returns {Promise<{created: number, updated: number, resolved: number, deleted: number}>}
 */
export async function syncConfluenceToGithub({
    confluenceSdk,
    githubClient,
    mapping,
    pages,
    resolvedLabel = 'resolved',
    deletedLabel = 'deleted-on-confluence'
}) {
    const stats = { created: 0, updated: 0, resolved: 0, deleted: 0 };

    for (const { pageId, pagePath } of pages) {
        logger.info(`[C→GH] Syncing comments for page "${pagePath}" (id=${pageId})`);

        const confluenceComments = await confluenceSdk.getComments(pageId);
        const discussion = await mapping.getOrCreateDiscussion(pagePath);
        const ghComments = await githubClient.getDiscussionComments(discussion.number);

        // Build an index: confluenceId → existing GH comment
        const ghByConfluenceId = new Map();
        for (const ghComment of ghComments) {
            const cId = extractConfluenceId(ghComment.body);
            if (cId) {
                ghByConfluenceId.set(cId, ghComment);
            }
        }

        // Track which Confluence IDs we see — anything in ghByConfluenceId
        // but NOT seen means the Confluence comment was deleted.
        const seenConfluenceIds = new Set();

        for (const cComment of confluenceComments) {
            const confluenceId = String(cComment.id);
            seenConfluenceIds.add(confluenceId);

            const htmlBody = cComment.body?.storage?.value || '';
            const markdownBody = htmlToMarkdown(htmlBody);
            const bodyChecksum = computeChecksum(markdownBody);

            // Skip comments that originated from GitHub (loop prevention)
            const storedHtml = cComment.body?.storage?.value || '';
            if (storedHtml.includes('github-discussion-comment-id:')) {
                logger.debug(`[C→GH] Skipping comment ${confluenceId} (originated from GitHub)`);
                continue;
            }

            const existing = ghByConfluenceId.get(confluenceId);

            if (existing) {
                // Check if content changed since last sync
                const existingChecksum = extractChecksum(existing.body);
                if (existingChecksum === bodyChecksum) {
                    logger.debug(`[C→GH] Comment ${confluenceId} unchanged, skipping`);
                    continue;
                }

                // Content changed — update the GH comment
                const markers = buildMarkers('confluence', confluenceId, bodyChecksum);
                const newBody = `${markdownBody}\n\n${markers}`;
                await githubClient.updateComment(existing.id, newBody);
                logger.info(`[C→GH] Updated GH comment for Confluence comment ${confluenceId}`);
                stats.updated++;
            } else {
                // New Confluence comment — create in Discussion
                const markers = buildMarkers('confluence', confluenceId, bodyChecksum);
                const newBody = `${markdownBody}\n\n${markers}`;
                await githubClient.addComment(discussion.id, newBody);
                logger.info(`[C→GH] Created GH comment for Confluence comment ${confluenceId}`);
                stats.created++;
            }
        }

        // Check for deleted Confluence comments: if a GH comment references a
        // Confluence ID that no longer appears in the Confluence comments list
        for (const [confluenceId, ghComment] of ghByConfluenceId) {
            if (!seenConfluenceIds.has(confluenceId)) {
                // Confluence comment was deleted — label the Discussion
                const cleanBody = stripMarkers(ghComment.body);
                if (!cleanBody.includes(`[${deletedLabel}]`)) {
                    const labelNote = '\n\n> **Note:** This comment was deleted on Confluence.';
                    const markers = buildMarkers('confluence', confluenceId, computeChecksum(cleanBody + labelNote));
                    await githubClient.updateComment(ghComment.id, cleanBody + labelNote + `\n\n${markers}`);
                    await githubClient.addLabel(discussion.id, deletedLabel);
                    logger.info(`[C→GH] Marked GH comment as deleted for Confluence comment ${confluenceId}`);
                    stats.deleted++;
                }
            }
        }

        // Handle resolved comments (Confluence v1 marks resolved at the status level)
        // The status field is available via extensions — check "status" === "resolved"
        for (const cComment of confluenceComments) {
            const isResolved = cComment.extensions?.resolution?.status === 'resolved'
                || cComment.status === 'resolved';
            if (isResolved) {
                const confluenceId = String(cComment.id);
                const ghComment = ghByConfluenceId.get(confluenceId);
                if (ghComment && !ghComment.body.includes(`[${resolvedLabel}]`)) {
                    await githubClient.addLabel(discussion.id, resolvedLabel);
                    logger.info(`[C→GH] Added "${resolvedLabel}" label for resolved Confluence comment ${confluenceId}`);
                    stats.resolved++;
                }
            }
        }
    }

    return stats;
}
