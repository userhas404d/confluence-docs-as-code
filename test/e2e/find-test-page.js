/**
 * Finds a page by title in the Confluence intinfra space.
 *
 * Usage:
 *   CONFLUENCE_TOKEN=$JIRA_API_TOKEN node test/e2e/find-test-page.js
 */
import axios from 'axios';
import qs from 'node:querystring';

const host = 'https://leolabs.atlassian.net';
const user = 'tmulder@leolabs.space';
const token = process.env.CONFLUENCE_TOKEN || process.env.JIRA_API_TOKEN;
const spaceKey = 'intinfra';
const title = 'comment-sync-e2e-test';

const auth = 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64');
const api = axios.create({
    baseURL: host,
    headers: { Authorization: auth, Accept: 'application/json' }
});

const query = qs.stringify({ title, type: 'page', spaceKey });
const resp = await api.get(`/wiki/rest/api/content?${query}`);
const page = resp.data.results?.[0];
if (page) {
    console.log(JSON.stringify({
        id: page.id,
        title: page.title,
        url: `${host}/wiki/spaces/${spaceKey}/pages/${page.id}`
    }, null, 2));
} else {
    console.log('Page not found');
}
