/**
 * Maps Confluence page IDs to GitHub Discussions using pathname-based titles.
 *
 * Giscus uses the page pathname as the Discussion title to associate pages
 * with Discussions. This module follows the same convention: the Discussion
 * title is the page path (e.g. "docs/getting-started").
 *
 * Mappings are resolved dynamically — no sidecar files needed.
 *
 * @module comment-sync/mapping
 */
import logger from '../logger.js';
import { buildDiscussionBody } from './discussion-body.js';

export default class PageDiscussionMapping {
    /**
     * @param {import('./github-client.js').default} githubClient
     * @param {string} categoryId - Discussion category node ID
     * @param {object} [context] - Extra context for rich Discussion bodies
     * @param {string} [context.confluenceHost] - e.g. "https://tenant.atlassian.net"
     * @param {string} [context.spaceKey]
     */
    constructor(githubClient, categoryId, context = {}) {
        this.github = githubClient;
        this.categoryId = categoryId;
        this.context = context;
        /** @type {Map<string, object>} pathname → Discussion */
        this._cache = new Map();
    }

    /**
     * Get or create a Discussion for a given page path.
     *
     * @param {string} pagePath - Page pathname (used as Discussion title)
     * @param {number} [pageId] - Confluence page ID (for rich body)
     * @returns {Promise<object>} Discussion { id, number, title }
     */
    async getOrCreateDiscussion(pagePath, pageId) {
        if (this._cache.has(pagePath)) {
            return this._cache.get(pagePath);
        }

        let discussion = await this.github.findDiscussion(pagePath, this.categoryId);

        if (!discussion) {
            logger.info(`No Discussion found for "${pagePath}", creating one`);
            const body = this._buildBody(pagePath, pageId);
            discussion = await this.github.createDiscussion(
                this.categoryId,
                pagePath,
                body
            );
            // createDiscussion doesn't return body — attach it for cache
            discussion.body = body;
        }

        this._cache.set(pagePath, discussion);
        return discussion;
    }

    /**
     * Build a rich Discussion body if context is available, otherwise fallback.
     * @private
     */
    _buildBody(pagePath, pageId) {
        const { confluenceHost, spaceKey } = this.context;
        if (confluenceHost && spaceKey && pageId) {
            return buildDiscussionBody({
                pagePath,
                confluenceHost,
                spaceKey,
                pageId,
                owner: this.github.owner,
                repo: this.github.repo
            });
        }
        return `Comment thread for documentation page: ${pagePath}`;
    }

    /**
     * Look up a Discussion without creating one if missing.
     *
     * @param {string} pagePath
     * @returns {Promise<object|null>}
     */
    async findDiscussion(pagePath) {
        if (this._cache.has(pagePath)) {
            return this._cache.get(pagePath);
        }

        const discussion = await this.github.findDiscussion(pagePath, this.categoryId);
        if (discussion) {
            this._cache.set(pagePath, discussion);
        }
        return discussion;
    }
}
