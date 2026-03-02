/**
 * @module pull/pull-sdk
 * @description Lightweight Confluence SDK for the pull workflow.
 * Unlike the main ConfluenceSdk (which transitively loads @actions/core config
 * at import time), this class can be used outside of GitHub Actions — e.g. from
 * the CLI.
 */
import fs from 'node:fs';
import axios from 'axios';
import retryPolicy from '../retry-policy.js';
import logger from '../logger.js';

/**
 * Minimal Confluence SDK that only exposes the v2 API methods
 * required by the pull workflow.
 */
class PullSdk {
    /**
     * @param {object} options
     * @param {string} options.host - Confluence base URL (e.g. https://tenant.atlassian.net)
     * @param {string} options.user - Confluence user email
     * @param {string} options.token - Confluence API token
     * @param {number} [options.pageLimit=25] - Page limit (unused, kept for compat)
     */
    constructor({ host, user, token, pageLimit = 25 }) {
        if (!host || typeof host !== 'string') {
            throw new TypeError('host must be a non-empty string');
        }
        if (!user || typeof user !== 'string') {
            throw new TypeError('user must be a non-empty string');
        }
        if (!token || typeof token !== 'string') {
            throw new TypeError('token must be a non-empty string');
        }

        this.host = host;
        this.pageLimit = pageLimit;
        this.authHeader =
            'Basic ' + Buffer.from(`${user}:${token}`).toString('base64');
        this.api = axios.create({
            validateStatus: (status) => status < 500,
            baseURL: host,
            headers: {
                'Authorization': this.authHeader,
                'Accept': 'application/json'
            }
        });
        retryPolicy(this.api);
    }

    /**
     * Validate an HTTP response and return the data payload.
     *
     * @param {object} response - Axios response
     * @param {number} response.status
     * @param {string} response.statusText
     * @param {object} response.data
     * @param {number[]} [validStatuses=[200]] - Acceptable HTTP status codes
     * @returns {object} response.data
     * @throws {Error} If the status is not in validStatuses
     */
    validateResponse({ status, statusText, data }, validStatuses = [200]) {
        if (!validStatuses.includes(status)) {
            logger.error(JSON.stringify({ status, statusText, data }, undefined, 2));
            throw new Error(`${status} ${statusText}: ${data?.message || 'Unknown error'}`);
        }
        return data;
    }

    /**
     * Fetch a page's body in ADF format via the Confluence v2 API.
     *
     * @param {string} pageId - Confluence page ID (numeric string)
     * @returns {Promise<object>} Page object with id, title, body.atlas_doc_format.value
     */
    async getPageBody(pageId) {
        const response = await this.api.get(
            `/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`
        );
        return this.validateResponse(response);
    }

    /**
     * Fetch the direct children of a page via the Confluence v2 API.
     * Paginates automatically and filters to type === 'page'.
     *
     * @param {string} pageId - Confluence page ID (numeric string)
     * @returns {Promise<Array<object>>} Ordered array of child page objects
     */
    async getPageChildren(pageId) {
        const children = [];
        let nextUri = `/wiki/api/v2/pages/${pageId}/direct-children?sort=child-position`;

        while (nextUri) {
            const response = await this.api.get(nextUri);
            const data = this.validateResponse(response);

            const pages = data.results.filter(
                item => item.type === 'page' && item.status === 'current'
            );
            children.push(...pages);

            nextUri = data._links?.next
                ? data._links.next
                : null;
        }

        return children;
    }

    /**
     * Fetch attachments for a page via the Confluence v2 API.
     * Paginates automatically.
     *
     * @param {string} pageId - Confluence page ID (numeric string)
     * @returns {Promise<Array<object>>} Array of attachment objects
     */
    async getAttachments(pageId) {
        const attachments = [];
        let nextUri = `/wiki/api/v2/pages/${pageId}/attachments`;

        while (nextUri) {
            const response = await this.api.get(nextUri);
            const data = this.validateResponse(response);

            attachments.push(...data.results);

            nextUri = data._links?.next || null;
        }

        return attachments;
    }

    /**
     * Download an attachment as a binary stream and save to disk.
     *
     * @param {string} downloadUrl - Full download URL
     * @param {string} destPath - Local filesystem path to save to
     * @returns {Promise<void>}
     */
    async downloadAttachment(downloadUrl, destPath) {
        const response = await this.api.get(downloadUrl, {
            responseType: 'stream'
        });

        if (response.status !== 200) {
            throw new Error(`${response.status} ${response.statusText}: Download failed`);
        }

        return new Promise((resolve, reject) => {
            const stream = fs.createWriteStream(destPath);
            response.data.pipe(stream);
            stream.on('close', resolve);
            stream.on('error', reject);
        });
    }
}

export default PullSdk;
