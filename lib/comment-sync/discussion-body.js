/**
 * Builds the standardized body for a page's GitHub Discussion.
 *
 * The body includes:
 *   - A link to the Confluence page
 *   - Last-synced timestamp
 *   - A link to manually trigger the comment-sync workflow
 *   - A brief description of how comment sync works
 *
 * @module comment-sync/discussion-body
 */

/**
 * Build the Discussion body for a page.
 *
 * @param {object} opts
 * @param {string} opts.pagePath   - Page path / Discussion title
 * @param {string} opts.confluenceHost - e.g. "https://leolabs.atlassian.net"
 * @param {string} opts.spaceKey   - Confluence space key
 * @param {number} opts.pageId     - Confluence page ID
 * @param {string} opts.owner      - GitHub repo owner
 * @param {string} opts.repo       - GitHub repo name
 * @param {Date}   [opts.lastSynced] - Last sync timestamp (defaults to now)
 * @returns {string} Markdown body
 */
export function buildDiscussionBody({
    pagePath,
    confluenceHost,
    spaceKey,
    pageId,
    owner,
    repo,
    lastSynced
}) {
    const ts = (lastSynced || new Date()).toISOString();
    const confluenceUrl = `${confluenceHost}/wiki/spaces/${spaceKey}/pages/${pageId}`;
    const workflowUrl = `https://github.com/${owner}/${repo}/actions/workflows/comment-sync.yml`;

    return [
        `> **Last synced:** ${ts}`,
        `> [▶ Run comment sync manually](${workflowUrl})`,
        '',
        '---',
        '',
        `📄 **Confluence page:** [${pagePath}](${confluenceUrl})`,
        '',
        '### How comment sync works',
        '',
        'This Discussion mirrors comments from its linked Confluence page.',
        'A scheduled GitHub Action polls Confluence for new, updated, resolved,',
        'and deleted comments and replicates them here. Comments posted in this',
        'Discussion are synced back to Confluence on the next run.',
        '',
        '| Direction | Trigger | What happens |',
        '|-----------|---------|--------------|',
        '| Confluence → GitHub | Scheduled poll | New/edited comments appear here; resolved comments get a `resolved` label; deleted comments get a `deleted-on-confluence` label |',
        '| GitHub → Confluence | Scheduled poll | New/edited Discussion comments are pushed to the Confluence page as inline comments |',
        '',
        'Each comment carries hidden deduplication markers so the sync is idempotent.',
        'Edits are detected via body checksums — only genuinely changed content is updated.',
    ].join('\n');
}

/**
 * Update only the "Last synced" timestamp in an existing Discussion body.
 *
 * @param {string} existingBody - Current Discussion body
 * @param {Date}   [lastSynced] - New timestamp (defaults to now)
 * @returns {string} Updated body
 */
export function refreshTimestamp(existingBody, lastSynced) {
    const ts = (lastSynced || new Date()).toISOString();
    return existingBody.replace(
        /^> \*\*Last synced:\*\* .+$/m,
        `> **Last synced:** ${ts}`
    );
}
