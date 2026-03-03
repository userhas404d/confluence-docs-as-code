/**
 * @module push/push-config
 * @description Configuration parser for the Confluence push tool (local CLI mode).
 * Accepts CLI flags and environment variables, then maps them to the INPUT_*
 * environment variables that @actions/core's getInput() expects.
 */
import { parseArgs } from 'node:util';

/**
 * @typedef {Object} PushConfig
 * @property {string} confluenceTenant - Atlassian tenant name (e.g., "leolabs")
 * @property {string} confluenceSpace - Confluence space key
 * @property {string} confluenceUser - Email for Basic auth
 * @property {string} confluenceToken - API token for Basic auth
 * @property {string} [confluenceParentPage] - Optional parent page title
 * @property {string} [confluenceTitlePrefix] - Optional title prefix
 * @property {boolean} forceUpdate - Force update all pages
 * @property {boolean} cleanup - Delete all pages instead of syncing
 * @property {string} krokiEnabled - Enable Kroki graph rendering ("yes"/"no")
 * @property {string} [krokiHost] - Custom Kroki host URL
 * @property {string} mermaidRenderer - Mermaid renderer strategy
 * @property {string} plantumlRenderer - PlantUML renderer strategy
 */

/**
 * Parse push configuration from CLI args and environment variables.
 * CLI flags take precedence over environment variables.
 *
 * @param {string[]} argv - CLI arguments (e.g., process.argv.slice(2))
 * @param {object} env - Environment variables (e.g., process.env)
 * @returns {PushConfig} Parsed and validated configuration
 * @throws {Error} If any required parameter is missing or invalid
 */
export function parsePushConfig(argv, env) {
    const options = {
        'confluence-tenant': { type: 'string' },
        'confluence-space': { type: 'string' },
        'confluence-user': { type: 'string' },
        'confluence-token': { type: 'string' },
        'confluence-parent-page': { type: 'string' },
        'confluence-title-prefix': { type: 'string' },
        'force-update': { type: 'boolean' },
        'cleanup': { type: 'boolean' },
        'kroki-enabled': { type: 'string' },
        'kroki-host': { type: 'string' },
        'mermaid-renderer': { type: 'string' },
        'plantuml-renderer': { type: 'string' }
    };

    const { values } = parseArgs({ args: argv, options, strict: false });

    const confluenceTenant = values['confluence-tenant'] || env.CONFLUENCE_TENANT;
    const confluenceSpace = values['confluence-space'] || env.CONFLUENCE_SPACE;
    const confluenceUser = values['confluence-user'] || env.CONFLUENCE_USER;
    const confluenceToken = values['confluence-token'] || env.CONFLUENCE_TOKEN;
    const confluenceParentPage = values['confluence-parent-page'] || env.CONFLUENCE_PARENT_PAGE || '';
    const confluenceTitlePrefix = values['confluence-title-prefix'] || env.CONFLUENCE_TITLE_PREFIX || '';
    const forceUpdate = values['force-update'] || env.CONFLUENCE_FORCE_UPDATE === 'yes' || false;
    const cleanup = values['cleanup'] || env.CONFLUENCE_CLEANUP === 'yes' || false;
    const krokiEnabled = values['kroki-enabled'] || env.KROKI_ENABLED || 'no';
    const krokiHost = values['kroki-host'] || env.KROKI_HOST || 'https://kroki.io';
    const mermaidRenderer = values['mermaid-renderer'] || env.MERMAID_RENDERER || '';
    const plantumlRenderer = values['plantuml-renderer'] || env.PLANTUML_RENDERER || '';

    // Validation
    if (!confluenceTenant) {
        throw new Error('confluenceTenant is required. Use --confluence-tenant or CONFLUENCE_TENANT env var.');
    }
    if (!confluenceSpace) {
        throw new Error('confluenceSpace is required. Use --confluence-space or CONFLUENCE_SPACE env var.');
    }
    if (!confluenceUser) {
        throw new Error('confluenceUser is required. Use --confluence-user or CONFLUENCE_USER env var.');
    }
    if (!confluenceToken) {
        throw new Error('confluenceToken is required. Use --confluence-token or CONFLUENCE_TOKEN env var.');
    }

    return {
        confluenceTenant,
        confluenceSpace,
        confluenceUser,
        confluenceToken,
        confluenceParentPage,
        confluenceTitlePrefix,
        forceUpdate,
        cleanup,
        krokiEnabled,
        krokiHost,
        mermaidRenderer,
        plantumlRenderer
    };
}

/**
 * Set INPUT_* environment variables so that @actions/core's getInput()
 * finds the configuration values. This must be called BEFORE any dynamic
 * import of modules that use @actions/core.
 *
 * @param {PushConfig} config - Parsed push configuration
 */
export function setActionsInputs(config) {
    process.env.INPUT_CONFLUENCE_TENANT = config.confluenceTenant;
    process.env.INPUT_CONFLUENCE_SPACE = config.confluenceSpace;
    process.env.INPUT_CONFLUENCE_USER = config.confluenceUser;
    process.env.INPUT_CONFLUENCE_TOKEN = config.confluenceToken;
    process.env.INPUT_CONFLUENCE_PARENT_PAGE = config.confluenceParentPage;
    process.env.INPUT_CONFLUENCE_TITLE_PREFIX = config.confluenceTitlePrefix;
    process.env.INPUT_CONFLUENCE_FORCE_UPDATE = config.forceUpdate ? 'yes' : 'no';
    process.env.INPUT_CONFLUENCE_CLEANUP = config.cleanup ? 'yes' : 'no';
    process.env.INPUT_KROKI_ENABLED = config.krokiEnabled;
    process.env.INPUT_KROKI_HOST = config.krokiHost;
    process.env.INPUT_MERMAID_RENDERER = config.mermaidRenderer;
    process.env.INPUT_PLANTUML_RENDERER = config.plantumlRenderer;
}
