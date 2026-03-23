/**
 * Entry point for the comment-sync GitHub Action.
 *
 * Modes:
 *   - "poll"  (scheduled): Full bidirectional sync for all mapped pages
 *   - "event" (discussion_comment webhook): Sync a single GH comment → Confluence
 *
 * @module comment-sync/index
 */
import * as core from '@actions/core';
import ConfluenceSdk from '../confluence-sdk.js';
import GithubClient from './github-client.js';
import PageDiscussionMapping from './mapping.js';
import { syncConfluenceToGithub } from './confluence-to-github.js';
import { batchSyncGithubToConfluence } from './github-to-confluence.js';
import { syncGithubCommentToConfluence } from './github-to-confluence.js';
import logger from '../logger.js';

async function run() {
    try {
        const mode = core.getInput('mode') || 'poll';
        const requiredInputOptions = { required: true, trimWhitespace: true };
        const optionalInputOptions = { required: false, trimWhitespace: true };

        // ── Confluence configuration ─────────────────────────────────
        const confluenceTenant = core.getInput('confluence_tenant', requiredInputOptions);
        const confluenceSdk = new ConfluenceSdk({
            host: `https://${confluenceTenant}.atlassian.net`,
            user: core.getInput('confluence_user', requiredInputOptions),
            token: core.getInput('confluence_token', requiredInputOptions),
            spaceKey: core.getInput('confluence_space', requiredInputOptions),
            pageLimit: 25
        });

        // ── GitHub configuration ─────────────────────────────────────
        const githubToken = core.getInput('github_token', requiredInputOptions);
        const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
        const githubClient = new GithubClient({ token: githubToken, owner, repo });

        // ── Discussion category ──────────────────────────────────────
        const categoryName = core.getInput('discussion_category', requiredInputOptions);
        const categoryId = await githubClient.findCategoryId(categoryName);
        if (!categoryId) {
            core.setFailed(`Discussion category "${categoryName}" not found. Create it in your repo's Discussions settings.`);
            return;
        }

        const mapping = new PageDiscussionMapping(githubClient, categoryId);

        // ── Page mapping ─────────────────────────────────────────────
        const pagesInput = core.getInput('page_mapping', requiredInputOptions);
        const pages = parsePageMapping(pagesInput);
        if (pages.length === 0) {
            core.setFailed('No valid page mappings found. Format: "pageId:pagePath" (one per line or comma-separated)');
            return;
        }

        const resolvedLabel = core.getInput('resolved_label', optionalInputOptions) || 'resolved';
        const deletedLabel = core.getInput('deleted_label', optionalInputOptions) || 'deleted-on-confluence';

        if (mode === 'poll') {
            logger.info('Running in poll mode — full bidirectional sync');

            // Direction 1: Confluence → GitHub
            const c2gStats = await syncConfluenceToGithub({
                confluenceSdk,
                githubClient,
                mapping,
                pages,
                resolvedLabel,
                deletedLabel
            });
            logger.info(`[C→GH] Done: ${c2gStats.created} created, ${c2gStats.updated} updated, ${c2gStats.resolved} resolved, ${c2gStats.deleted} deleted`);

            // Direction 2: GitHub → Confluence
            const g2cStats = await batchSyncGithubToConfluence({
                confluenceSdk,
                githubClient,
                mapping,
                pages
            });
            logger.info(`[GH→C] Done: ${g2cStats.created} created, ${g2cStats.updated} updated, ${g2cStats.skipped} skipped`);

            core.setOutput('confluence_to_github', JSON.stringify(c2gStats));
            core.setOutput('github_to_confluence', JSON.stringify(g2cStats));

        } else if (mode === 'event') {
            logger.info('Running in event mode — single comment sync');

            const eventPayload = JSON.parse(process.env.GITHUB_EVENT_PATH
                ? (await import('node:fs')).readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')
                : '{}');

            const discussionTitle = eventPayload.discussion?.title;
            const comment = eventPayload.comment;

            if (!discussionTitle || !comment) {
                core.setFailed('Event payload missing discussion.title or comment');
                return;
            }

            // Find the Confluence page ID for this Discussion
            const page = pages.find(p => p.pagePath === discussionTitle);
            if (!page) {
                logger.info(`Discussion "${discussionTitle}" is not mapped to a Confluence page, skipping`);
                return;
            }

            const result = await syncGithubCommentToConfluence({
                confluenceSdk,
                comment: { node_id: comment.node_id, body: comment.body },
                pageId: page.pageId
            });

            core.setOutput('sync_result', JSON.stringify(result));
            logger.info(`[GH→C] Result: ${result.action}`);

        } else {
            core.setFailed(`Unknown mode "${mode}". Use "poll" or "event".`);
        }

    } catch (error) {
        core.setFailed(`Comment sync failed: ${error.message}`);
        logger.error(error.stack || error.message);
    }
}

/**
 * Parse the page_mapping input.
 * Accepts "pageId:pagePath" entries separated by newlines or commas.
 *
 * @param {string} input
 * @returns {Array<{pageId: number, pagePath: string}>}
 */
function parsePageMapping(input) {
    if (!input) return [];

    return input
        .split(/[\n,]+/)
        .map(line => line.trim())
        .filter(line => line && line.includes(':'))
        .map(line => {
            const colonIdx = line.indexOf(':');
            const pageId = Number(line.slice(0, colonIdx).trim());
            const pagePath = line.slice(colonIdx + 1).trim();
            if (Number.isNaN(pageId) || !pagePath) return null;
            return { pageId, pagePath };
        })
        .filter(Boolean);
}

await run();
