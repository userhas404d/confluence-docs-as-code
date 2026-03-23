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

export default class PageDiscussionMapping {
    /**
     * @param {import('./github-client.js').default} githubClient
     * @param {string} categoryId - Discussion category node ID
     */
    constructor(githubClient, categoryId) {
        this.github = githubClient;
        this.categoryId = categoryId;
        /** @type {Map<string, object>} pathname → Discussion */
        this._cache = new Map();
    }

    /**
     * Get or create a Discussion for a given page path.
     *
     * @param {string} pagePath - Page pathname (used as Discussion title)
     * @returns {Promise<object>} Discussion { id, number, title }
     */
    async getOrCreateDiscussion(pagePath) {
        if (this._cache.has(pagePath)) {
            return this._cache.get(pagePath);
        }

        let discussion = await this.github.findDiscussion(pagePath, this.categoryId);

        if (!discussion) {
            logger.info(`No Discussion found for "${pagePath}", creating one`);
            discussion = await this.github.createDiscussion(
                this.categoryId,
                pagePath,
                `Comment thread for documentation page: ${pagePath}`
            );
        }

        this._cache.set(pagePath, discussion);
        return discussion;
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
