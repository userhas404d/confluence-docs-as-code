#!/usr/bin/env node

/**
 * @module push
 * @description CLI entry point for pushing MkDocs documentation to Confluence.
 *
 * This module allows the push (publish) workflow to run locally without
 * GitHub Actions. It parses CLI flags / environment variables, maps them
 * to the INPUT_* env vars that @actions/core's getInput() reads, then
 * dynamically imports the existing confluence-syncer module.
 *
 * Usage:
 *   node lib/push/index.js --source-dir ./output \
 *     --confluence-tenant leolabs \
 *     --confluence-space MYSPACE \
 *     --confluence-user user@example.com \
 *     --confluence-token ATATT3x... \
 *     [--confluence-parent-page "Parent Page Title"] \
 *     [--confluence-title-prefix "Prefix - "] \
 *     [--repo-url https://github.com/org/repo] \
 *     [--force-update] \
 *     [--cleanup]
 *
 * Environment variables:
 *   CONFLUENCE_TENANT, CONFLUENCE_SPACE, CONFLUENCE_USER, CONFLUENCE_TOKEN,
 *   CONFLUENCE_PARENT_PAGE, CONFLUENCE_TITLE_PREFIX, CONFLUENCE_FORCE_UPDATE,
 *   CONFLUENCE_CLEANUP, KROKI_ENABLED, KROKI_HOST, MERMAID_RENDERER,
 *   PLANTUML_RENDERER, PUSH_REPO_URL
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { parsePushConfig, setActionsInputs } from './push-config.js';

/**
 * Get the current git SHA and ref name, falling back to placeholders.
 *
 * @returns {{ sha: string, refName: string }}
 */
function getGitInfo() {
    try {
        const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        const refName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        return { sha, refName };
    } catch {
        return { sha: 'local', refName: 'local' };
    }
}

/**
 * Ensure mkdocs.yml contains a repo_url. If missing and a URL is provided
 * via --repo-url or PUSH_REPO_URL, it will be injected into the file.
 *
 * @param {string} sourceDir - Directory containing mkdocs.yml
 * @param {string|undefined} repoUrl - Optional repo URL from CLI/env
 * @throws {Error} If repo_url is missing and no fallback is provided
 */
function ensureRepoUrl(sourceDir, repoUrl) {
    const mkdocsPath = path.join(sourceDir, 'mkdocs.yml');
    if (!existsSync(mkdocsPath)) {
        throw new Error(`mkdocs.yml not found in ${sourceDir}`);
    }

    const content = readFileSync(mkdocsPath, 'utf8');
    const hasRepoUrl = /^repo_url\s*:/m.test(content);

    if (hasRepoUrl) {
        return; // Already present
    }

    if (!repoUrl) {
        throw new Error(
            'repo_url is missing from mkdocs.yml and no --repo-url flag or PUSH_REPO_URL env var was provided.\n' +
            'Either add "repo_url: https://github.com/org/repo" to mkdocs.yml,\n' +
            'or pass --repo-url https://github.com/org/repo on the command line.'
        );
    }

    // Inject repo_url after site_name
    const patched = content.replace(
        /^(site_name\s*:.*)$/m,
        `$1\nrepo_url: ${repoUrl}`
    );
    writeFileSync(mkdocsPath, patched, 'utf8');
    console.log(`Injected repo_url: ${repoUrl} into ${mkdocsPath}`);
}

/**
 * Main CLI entry point for push.
 */
async function main() {
    // ── 1. Parse extra CLI options not handled by push-config ──
    const { values: extraValues } = parseArgs({
        args: process.argv.slice(2),
        options: {
            'source-dir': { type: 'string' },
            'repo-url': { type: 'string' },
            'help': { type: 'boolean', short: 'h' }
        },
        strict: false
    });

    if (extraValues.help) {
        printUsage();
        process.exit(0);
    }

    const sourceDir = path.resolve(extraValues['source-dir'] || process.env.PUSH_SOURCE_DIR || '.');
    const repoUrl = extraValues['repo-url'] || process.env.PUSH_REPO_URL;

    // ── 2. Parse push configuration (CLI flags + env vars) ──
    let config;
    try {
        config = parsePushConfig(process.argv.slice(2), process.env);
    } catch (err) {
        console.error(`Configuration error: ${err.message}`);
        process.exit(1);
    }

    // ── 3. Validate source directory ──
    if (!existsSync(path.join(sourceDir, 'mkdocs.yml'))) {
        console.error(`Error: mkdocs.yml not found in ${sourceDir}`);
        console.error('Use --source-dir to specify the directory containing mkdocs.yml');
        process.exit(1);
    }

    // ── 4. Ensure repo_url is present in mkdocs.yml ──
    try {
        ensureRepoUrl(sourceDir, repoUrl);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    // ── 5. Set INPUT_* env vars for @actions/core ──
    setActionsInputs(config);

    // ── 6. Set GitHub context env vars ──
    const git = getGitInfo();
    process.env.GITHUB_SHA = process.env.GITHUB_SHA || git.sha;
    process.env.GITHUB_REF_NAME = process.env.GITHUB_REF_NAME || git.refName;

    // ── 7. Set GITHUB_STEP_SUMMARY to a temp file to prevent core.summary crash ──
    if (!process.env.GITHUB_STEP_SUMMARY) {
        const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'push-summary-'));
        process.env.GITHUB_STEP_SUMMARY = path.join(tmpDir, 'summary.md');
        writeFileSync(process.env.GITHUB_STEP_SUMMARY, '', 'utf8');
    }

    // ── 8. Change into source directory (context.js reads mkdocs.yml from cwd) ──
    const originalCwd = process.cwd();
    process.chdir(sourceDir);

    console.log('\nConfluence Push');
    console.log(`${'─'.repeat(50)}`);
    console.log(`Source:  ${sourceDir}`);
    console.log(`Tenant:  ${config.confluenceTenant}`);
    console.log(`Space:   ${config.confluenceSpace}`);
    console.log(`User:    ${config.confluenceUser}`);
    console.log(`Action:  ${config.cleanup ? 'cleanup (delete all pages)' : 'sync'}`);
    if (config.confluenceParentPage) {
        console.log(`Parent:  ${config.confluenceParentPage}`);
    }
    if (config.confluenceTitlePrefix) {
        console.log(`Prefix:  ${config.confluenceTitlePrefix}`);
    }
    console.log(`${'─'.repeat(50)}\n`);

    // ── 9. Dynamically import the existing syncer (after env vars are set) ──
    try {
        const { sync, cleanup } = await import('../confluence-syncer.js');
        const action = config.cleanup ? cleanup : sync;
        await action();
    } catch (err) {
        console.error(`\nPush failed: ${err.message}`);
        if (process.env.RUNNER_DEBUG === '1' || process.env.ACTIONS_STEP_DEBUG === 'true') {
            console.error(err.stack);
        }
        process.chdir(originalCwd);
        process.exit(1);
    }

    process.chdir(originalCwd);
}

/**
 * Print usage information.
 */
function printUsage() {
    console.log(`
Usage: node lib/push/index.js [options]

Push (sync) MkDocs documentation to Confluence.

Required:
  --confluence-tenant <name>     Atlassian tenant (e.g., "leolabs")
  --confluence-space  <key>      Confluence space key
  --confluence-user   <email>    User email for Basic auth
  --confluence-token  <token>    API token for Basic auth

Optional:
  --source-dir <path>            Directory containing mkdocs.yml (default: ".")
  --repo-url <url>               Repository URL (injected into mkdocs.yml if missing)
  --confluence-parent-page <t>   Parent page title for nesting
  --confluence-title-prefix <p>  Prefix for all page titles
  --force-update                 Force update all pages
  --cleanup                      Delete all synced pages instead of syncing
  --kroki-enabled <yes|no>       Enable Kroki graph rendering (default: "no")
  --kroki-host <url>             Custom Kroki host (default: "https://kroki.io")
  --mermaid-renderer <renderer>  Mermaid rendering strategy
  --plantuml-renderer <renderer> PlantUML rendering strategy
  -h, --help                     Show this help message

Environment Variables:
  CONFLUENCE_TENANT, CONFLUENCE_SPACE, CONFLUENCE_USER, CONFLUENCE_TOKEN,
  CONFLUENCE_PARENT_PAGE, CONFLUENCE_TITLE_PREFIX, CONFLUENCE_FORCE_UPDATE,
  CONFLUENCE_CLEANUP, PUSH_SOURCE_DIR, PUSH_REPO_URL

Example:
  node lib/push/index.js \\
    --source-dir ./output \\
    --confluence-tenant leolabs \\
    --confluence-space TEST \\
    --confluence-user user@example.com \\
    --confluence-token ATATT3x... \\
    --repo-url https://github.com/org/repo
`);
}

export { ensureRepoUrl, getGitInfo };

// Run main() only when this module is invoked directly (not imported for testing)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
    main();
}
