/**
 * @module pull/pull-config
 * @description Configuration parser for the Confluence pull tool.
 * Supports CLI flags via Node.js parseArgs and environment variable fallback.
 */
import { parseArgs } from 'node:util';

/**
 * @typedef {Object} PullConfig
 * @property {string} confluenceUrl - Base URL (e.g., "https://leolabs.atlassian.net")
 * @property {string} confluenceUser - Email for Basic auth
 * @property {string} confluenceToken - API token for Basic auth
 * @property {string} rootPageId - Confluence page ID to start tree walk
 * @property {string} outputDir - Output directory path (default: "./output")
 */

/**
 * Parse pull configuration from CLI args and environment variables.
 * CLI flags take precedence over environment variables.
 *
 * @param {string[]} argv - CLI arguments (e.g., process.argv.slice(2))
 * @param {object} env - Environment variables (e.g., process.env)
 * @returns {PullConfig} Parsed and validated configuration
 * @throws {Error} If any required parameter is missing or invalid
 */
export function parsePullConfig(argv, env) {
    const options = {
        'confluence-url': { type: 'string' },
        'confluence-user': { type: 'string' },
        'confluence-token': { type: 'string' },
        'root-page-id': { type: 'string' },
        'output-dir': { type: 'string' }
    };

    const { values } = parseArgs({ args: argv, options, strict: false });

    const confluenceUrl = values['confluence-url'] || env.CONFLUENCE_URL;
    const confluenceUser = values['confluence-user'] || env.CONFLUENCE_USER;
    const confluenceToken = values['confluence-token'] || env.CONFLUENCE_TOKEN;
    const rootPageId = values['root-page-id'] || env.CONFLUENCE_ROOT_ID;
    const outputDir = values['output-dir'] || env.OUTPUT_DIR || './output';

    // Validation
    if (!confluenceUrl) {
        throw new Error('confluenceUrl is required. Use --confluence-url or CONFLUENCE_URL env var.');
    }
    if (!confluenceUrl.startsWith('https://')) {
        throw new Error('confluenceUrl must start with https://');
    }
    if (!confluenceUser) {
        throw new Error('confluenceUser is required. Use --confluence-user or CONFLUENCE_USER env var.');
    }
    if (!confluenceToken) {
        throw new Error('confluenceToken is required. Use --confluence-token or CONFLUENCE_TOKEN env var.');
    }
    if (!rootPageId) {
        throw new Error('rootPageId is required. Use --root-page-id or CONFLUENCE_ROOT_ID env var.');
    }

    return {
        confluenceUrl,
        confluenceUser,
        confluenceToken,
        rootPageId,
        outputDir
    };
}
