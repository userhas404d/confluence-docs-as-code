/**
 * End-to-end test for comment-sync: Confluence → GitHub Discussions.
 *
 * Preconditions:
 *   - A Confluence page "comment-sync-e2e-test" exists in intinfra space (id=3914629127)
 *   - At least one comment exists on that page
 *   - GitHub Discussions are enabled on leolabs-space/sre-docs
 *   - "General" category exists (DIC_kwDOJx66Y84C5GpK)
 *
 * Environment:
 *   CONFLUENCE_TOKEN  — Confluence API token (JIRA_API_TOKEN)
 *   GITHUB_TOKEN      — GitHub token with repo scope (defaults to `gh auth token`)
 *
 * Usage:
 *   CONFLUENCE_TOKEN="$JIRA_API_TOKEN" node test/e2e/comment-sync-e2e.js
 */
import { execSync } from 'node:child_process';

// ── Resolve tokens BEFORE importing SDK modules ──────────────────────────
// (config.js reads @actions/core getInput at import time, which reads INPUT_ env vars)
const confluenceToken = process.env.CONFLUENCE_TOKEN || process.env.JIRA_API_TOKEN;
if (!confluenceToken) {
    console.error('❌ CONFLUENCE_TOKEN or JIRA_API_TOKEN must be set');
    process.exit(1);
}

const githubToken = process.env.GITHUB_TOKEN
    || execSync('gh auth token', { encoding: 'utf8' }).trim();

// Set INPUT_ env vars so @actions/core getInput doesn't throw on required inputs
process.env.INPUT_CONFLUENCE_TENANT = 'leolabs';
process.env.INPUT_CONFLUENCE_USER = 'tmulder@leolabs.space';
process.env.INPUT_CONFLUENCE_TOKEN = confluenceToken;
process.env.INPUT_CONFLUENCE_SPACE = 'intinfra';
process.env.INPUT_DOCS_DIR = '.';
process.env.INPUT_CONFLUENCE_PARENT_PAGE = '';
process.env.INPUT_CONFLUENCE_TITLE_PREFIX = '';
process.env.INPUT_CONFLUENCE_FORCE_UPDATE = 'no';
process.env.INPUT_CONFLUENCE_CLEANUP = 'no';
process.env.INPUT_MERMAID_RENDERER = 'none';
process.env.INPUT_PLANTUML_RENDERER = 'none';
process.env.INPUT_KROKI_ENABLED = 'no';

// Now safe to import modules that transitively pull in config.js
const { default: ConfluenceSdk } = await import('../../lib/confluence-sdk.js');
const { default: GithubClient } = await import('../../lib/comment-sync/github-client.js');
const { default: PageDiscussionMapping } = await import('../../lib/comment-sync/mapping.js');
const { syncConfluenceToGithub } = await import('../../lib/comment-sync/confluence-to-github.js');

const pageId = 3914629127;    // comment-sync-e2e-test page in intinfra
const pagePath = 'comment-sync-e2e-test';
const categoryId = 'DIC_kwDOJx66Y84C5GpK';  // "General" discussion category

// ── Confluence SDK ───────────────────────────────────────────────────────
const confluenceSdk = new ConfluenceSdk({
    host: 'https://leolabs.atlassian.net',
    user: 'tmulder@leolabs.space',
    token: confluenceToken,
    spaceKey: 'intinfra',
    pageLimit: 25
});

// ── GitHub Client ────────────────────────────────────────────────────────
const githubClient = new GithubClient({
    token: githubToken,
    owner: 'leolabs-space',
    repo: 'sre-docs'
});

// ── Test Confluence→GitHub sync ──────────────────────────────────────────
console.log('\n🔄 Step 1: Verify Confluence page and comments exist');
const comments = await confluenceSdk.getComments(pageId);
console.log(`   Found ${comments.length} comment(s) on page ${pageId}`);

if (comments.length === 0) {
    console.error('❌ No comments found on test page. Add a comment first.');
    process.exit(1);
}

console.log('\n🔄 Step 2: Verify GitHub Discussions access');
const catId = await githubClient.findCategoryId('General');
console.log(`   Category "General" ID: ${catId}`);

if (!catId) {
    console.error('❌ Discussion category "General" not found');
    process.exit(1);
}

console.log('\n🔄 Step 3: Run Confluence → GitHub sync');
const confluenceHost = 'https://leolabs.atlassian.net';
const spaceKey = 'intinfra';
const mapping = new PageDiscussionMapping(githubClient, categoryId, {
    confluenceHost,
    spaceKey
});
const pages = [{ pageId, pagePath }];

const stats = await syncConfluenceToGithub({
    confluenceSdk,
    githubClient,
    mapping,
    pages,
    confluenceHost,
    spaceKey,
    resolvedLabel: 'resolved',
    deletedLabel: 'deleted-on-confluence'
});

console.log('\n✅ Sync complete!');
console.log(`   Created: ${stats.created}`);
console.log(`   Updated: ${stats.updated}`);
console.log(`   Resolved: ${stats.resolved}`);
console.log(`   Deleted: ${stats.deleted}`);

// ── Verify Discussion was created ────────────────────────────────────────
console.log('\n🔄 Step 4: Verify Discussion exists in sre-docs');
const discussion = await githubClient.findDiscussion(pagePath, categoryId);
if (discussion) {
    console.log(`   ✅ Discussion found: #${discussion.number} — "${discussion.title}"`);

    const ghComments = await githubClient.getDiscussionComments(discussion.number);
    console.log(`   Comments in Discussion: ${ghComments.length}`);
    for (const c of ghComments) {
        console.log(`     - [${c.author}] ${c.body.substring(0, 80)}...`);
    }
} else {
    console.error('   ❌ Discussion NOT found — sync may have failed');
    process.exit(1);
}

console.log('\n🎉 E2E test passed! Comment-sync is working.');
