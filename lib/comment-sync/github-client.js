/**
 * GitHub Discussions GraphQL client.
 *
 * Uses @actions/github's getOctokit to interact with the GitHub GraphQL API.
 * Handles creating/finding Discussions and adding/updating comments.
 *
 * @module comment-sync/github-client
 */
import { getOctokit } from '@actions/github';
import logger from '../logger.js';

/**
 * @typedef {object} DiscussionComment
 * @property {string} id       - GraphQL node ID
 * @property {string} body     - Comment body (Markdown)
 * @property {string} author   - Author login
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export default class GithubClient {
    /**
     * @param {string} token - GitHub token with discussions read/write scope
     * @param {string} owner - Repository owner
     * @param {string} repo  - Repository name
     */
    constructor({ token, owner, repo }) {
        this.octokit = getOctokit(token);
        this.owner = owner;
        this.repo = repo;
    }

    /**
     * Get the repository's GraphQL node ID (needed for mutations).
     * Cached after first call.
     * @returns {Promise<string>}
     */
    async getRepoId() {
        if (this._repoId) return this._repoId;

        const { repository } = await this.octokit.graphql(`
            query($owner: String!, $repo: String!) {
                repository(owner: $owner, name: $repo) {
                    id
                }
            }
        `, { owner: this.owner, repo: this.repo });

        this._repoId = repository.id;
        return this._repoId;
    }

    /**
     * Find a Discussion category by name.
     * @param {string} categoryName
     * @returns {Promise<string|null>} Category node ID
     */
    async findCategoryId(categoryName) {
        const { repository } = await this.octokit.graphql(`
            query($owner: String!, $repo: String!) {
                repository(owner: $owner, name: $repo) {
                    discussionCategories(first: 25) {
                        nodes { id name }
                    }
                }
            }
        `, { owner: this.owner, repo: this.repo });

        const cat = repository.discussionCategories.nodes
            .find(c => c.name === categoryName);
        return cat?.id || null;
    }

    /**
     * Find a Discussion by its title (exact match) in a specific category.
     * @param {string} title
     * @param {string} categoryId
     * @returns {Promise<object|null>} Discussion node with id, number, title, body
     */
    async findDiscussion(title, categoryId) {
        let cursor = null;
        while (true) {
            const { repository } = await this.octokit.graphql(`
                query($owner: String!, $repo: String!, $categoryId: ID!, $cursor: String) {
                    repository(owner: $owner, name: $repo) {
                        discussions(
                            categoryId: $categoryId
                            first: 50
                            after: $cursor
                        ) {
                            pageInfo { hasNextPage endCursor }
                            nodes { id number title body }
                        }
                    }
                }
            `, { owner: this.owner, repo: this.repo, categoryId, cursor });

            const disc = repository.discussions.nodes.find(d => d.title === title);
            if (disc) return disc;

            const { hasNextPage, endCursor } = repository.discussions.pageInfo;
            if (!hasNextPage) break;
            cursor = endCursor;
        }
        return null;
    }

    /**
     * Create a new Discussion.
     * @param {string} categoryId
     * @param {string} title
     * @param {string} body - Markdown body
     * @returns {Promise<object>} Created discussion { id, number, title }
     */
    async createDiscussion(categoryId, title, body) {
        const repoId = await this.getRepoId();

        const { createDiscussion: { discussion } } = await this.octokit.graphql(`
            mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
                createDiscussion(input: {
                    repositoryId: $repoId
                    categoryId: $categoryId
                    title: $title
                    body: $body
                }) {
                    discussion { id number title }
                }
            }
        `, { repoId, categoryId, title, body });

        logger.info(`Created Discussion #${discussion.number}: ${title}`);
        return discussion;
    }

    /**
     * Fetch all comments for a Discussion.
     * Paginates automatically.
     * @param {number} discussionNumber
     * @returns {Promise<DiscussionComment[]>}
     */
    async getDiscussionComments(discussionNumber) {
        const comments = [];
        let cursor = null;

        while (true) {
            const { repository } = await this.octokit.graphql(`
                query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
                    repository(owner: $owner, name: $repo) {
                        discussion(number: $number) {
                            comments(first: 100, after: $cursor) {
                                pageInfo { hasNextPage endCursor }
                                nodes {
                                    id
                                    body
                                    author { login }
                                    createdAt
                                    updatedAt
                                }
                            }
                        }
                    }
                }
            `, { owner: this.owner, repo: this.repo, number: discussionNumber, cursor });

            const { nodes, pageInfo } = repository.discussion.comments;
            for (const c of nodes) {
                comments.push({
                    id: c.id,
                    body: c.body,
                    author: c.author?.login || 'ghost',
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt
                });
            }

            if (!pageInfo.hasNextPage) break;
            cursor = pageInfo.endCursor;
        }

        return comments;
    }

    /**
     * Add a comment to a Discussion.
     * @param {string} discussionId - GraphQL node ID
     * @param {string} body - Markdown body
     * @returns {Promise<object>} Created comment { id }
     */
    async addComment(discussionId, body) {
        const { addDiscussionComment: { comment } } = await this.octokit.graphql(`
            mutation($discussionId: ID!, $body: String!) {
                addDiscussionComment(input: {
                    discussionId: $discussionId
                    body: $body
                }) {
                    comment { id }
                }
            }
        `, { discussionId, body });

        return comment;
    }

    /**
     * Update an existing Discussion comment.
     * @param {string} commentId - GraphQL node ID
     * @param {string} body - Updated markdown body
     * @returns {Promise<object>} Updated comment { id }
     */
    async updateComment(commentId, body) {
        const { updateDiscussionComment: { comment } } = await this.octokit.graphql(`
            mutation($commentId: ID!, $body: String!) {
                updateDiscussionComment(input: {
                    commentId: $commentId
                    body: $body
                }) {
                    comment { id }
                }
            }
        `, { commentId, body });

        return comment;
    }

    /**
     * Update a Discussion's body.
     * @param {string} discussionId - GraphQL node ID
     * @param {string} body - New markdown body
     * @returns {Promise<object>} Updated discussion { id }
     */
    async updateDiscussion(discussionId, body) {
        const { updateDiscussion: { discussion } } = await this.octokit.graphql(`
            mutation($discussionId: ID!, $body: String!) {
                updateDiscussion(input: {
                    discussionId: $discussionId
                    body: $body
                }) {
                    discussion { id }
                }
            }
        `, { discussionId, body });

        return discussion;
    }

    /**
     * Add a label to a Discussion.
     * @param {string} discussionId - GraphQL node ID (of the Discussion, not comment)
     * @param {string} labelName - Label name to add
     * @returns {Promise<void>}
     */
    async addLabel(discussionId, labelName) {
        // First, find or create the label
        const labelId = await this._findOrCreateLabel(labelName);
        if (!labelId) {
            logger.warn(`Could not find or create label "${labelName}"`);
            return;
        }

        await this.octokit.graphql(`
            mutation($labelableId: ID!, $labelIds: [ID!]!) {
                addLabelsToLabelable(input: {
                    labelableId: $labelableId
                    labelIds: $labelIds
                }) {
                    clientMutationId
                }
            }
        `, { labelableId: discussionId, labelIds: [labelId] });
    }

    /**
     * @private
     * Find a label in the repo by name, or create it.
     * @param {string} name
     * @returns {Promise<string|null>} Label node ID
     */
    async _findOrCreateLabel(name) {
        const { repository } = await this.octokit.graphql(`
            query($owner: String!, $repo: String!, $name: String!) {
                repository(owner: $owner, name: $repo) {
                    label(name: $name) { id }
                }
            }
        `, { owner: this.owner, repo: this.repo, name });

        if (repository.label) return repository.label.id;

        // Create via REST (GraphQL doesn't have createLabel mutation)
        try {
            const { data } = await this.octokit.rest.issues.createLabel({
                owner: this.owner,
                repo: this.repo,
                name,
                color: 'ededed',
                description: 'Auto-created by comment-sync'
            });
            return data.node_id;
        } catch (err) {
            logger.warn(`Failed to create label "${name}": ${err.message}`);
            return null;
        }
    }
}
