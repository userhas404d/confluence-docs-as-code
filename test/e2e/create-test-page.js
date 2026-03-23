/**
 * Creates a test page in Confluence for E2E testing of comment-sync.
 *
 * Usage:
 *   CONFLUENCE_TOKEN=$JIRA_API_TOKEN node test/e2e/create-test-page.js
 */
import axios from 'axios';

const host = 'https://leolabs.atlassian.net';
const user = 'tmulder@leolabs.space';
const token = process.env.CONFLUENCE_TOKEN || process.env.JIRA_API_TOKEN;
const spaceKey = 'intinfra';

if (!token) {
    console.error('Set CONFLUENCE_TOKEN or JIRA_API_TOKEN');
    process.exit(1);
}

const auth = 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64');
const api = axios.create({
    baseURL: host,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' }
});

const payload = {
    title: 'comment-sync-e2e-test',
    type: 'page',
    space: { key: spaceKey },
    body: {
        storage: {
            value: '<h1>Comment Sync E2E Test</h1>'
                + '<p>This is a test page for validating bidirectional comment sync '
                + 'between Confluence and GitHub Discussions.</p>'
                + `<p>Created: ${new Date().toISOString()}</p>`,
            representation: 'storage'
        }
    }
};

try {
    const resp = await api.post('/wiki/rest/api/content', payload);
    const { id, title, _links } = resp.data;
    const url = _links.base + _links.webui;
    console.log(JSON.stringify({ id, title, url }, null, 2));
} catch (err) {
    console.error('Status:', err.response?.status);
    console.error('Body:', JSON.stringify(err.response?.data, null, 2));
    process.exit(1);
}
