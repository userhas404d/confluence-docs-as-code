/**
 * Add a test comment to the Confluence page for E2E testing.
 *
 * Usage:
 *   CONFLUENCE_TOKEN=$JIRA_API_TOKEN node test/e2e/add-test-comment.js
 */
import axios from 'axios';

const host = 'https://leolabs.atlassian.net';
const user = 'tmulder@leolabs.space';
const token = process.env.CONFLUENCE_TOKEN || process.env.JIRA_API_TOKEN;
const pageId = '3914629127';

const auth = 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64');
const api = axios.create({
    baseURL: host,
    headers: {
        Authorization: auth,
        Accept: 'application/json',
        'Content-Type': 'application/json'
    }
});

const commentBody = {
    type: 'comment',
    container: { id: pageId, type: 'page' },
    body: {
        storage: {
            value: '<p>This is an <strong>E2E test comment</strong> created to validate the comment-sync feature.</p><p>It should appear in the GitHub Discussion for this page.</p>',
            representation: 'storage'
        }
    }
};

const resp = await api.post(`/wiki/rest/api/content`, commentBody);
console.log(JSON.stringify({
    commentId: resp.data.id,
    title: resp.data.title,
    status: 'created'
}, null, 2));
