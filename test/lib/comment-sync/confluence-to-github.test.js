import { expect } from 'chai';
import sinon from 'sinon';
import { syncConfluenceToGithub } from '../../../lib/comment-sync/confluence-to-github.js';
import logger from '../../../lib/logger.js';

const sandbox = sinon.createSandbox();

describe('comment-sync/confluence-to-github', () => {
    let confluenceSdk, githubClient, mapping;

    beforeEach(() => {
        sandbox.stub(logger, 'info');
        sandbox.stub(logger, 'debug');
        sandbox.stub(logger, 'warn');

        confluenceSdk = {
            getComments: sandbox.stub()
        };

        githubClient = {
            getDiscussionComments: sandbox.stub(),
            addComment: sandbox.stub().resolves({ id: 'new-gh-comment' }),
            updateComment: sandbox.stub().resolves({ id: 'updated-gh-comment' }),
            addLabel: sandbox.stub().resolves()
        };

        mapping = {
            getOrCreateDiscussion: sandbox.stub().resolves({
                id: 'disc-node-1',
                number: 1,
                title: 'docs/test-page'
            })
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should create a GH comment for a new Confluence comment', async () => {
        confluenceSdk.getComments.resolves([
            {
                id: '100',
                body: { storage: { value: '<p>Hello from Confluence</p>' } },
                version: { number: 1 }
            }
        ]);
        githubClient.getDiscussionComments.resolves([]);

        const stats = await syncConfluenceToGithub({
            confluenceSdk,
            githubClient,
            mapping,
            pages: [{ pageId: 12345, pagePath: 'docs/test-page' }],
            confluenceHost: 'https://acme.atlassian.net',
            spaceKey: 'ENG'
        });

        expect(stats.created).to.equal(1);
        expect(githubClient.addComment.calledOnce).to.be.true;
        const body = githubClient.addComment.firstCall.args[1];
        expect(body).to.include('confluence-comment-id:100');
        expect(body).to.include('Synced from Confluence');
        expect(body).to.include('https://acme.atlassian.net/wiki/spaces/ENG/pages/12345?focusedCommentId=100');
    });

    it('should skip comments that originated from GitHub', async () => {
        confluenceSdk.getComments.resolves([
            {
                id: '101',
                body: { storage: { value: '<p>Mirror</p>\n<!-- github-discussion-comment-id:MDEyOk -->' } },
                version: { number: 1 }
            }
        ]);
        githubClient.getDiscussionComments.resolves([]);

        const stats = await syncConfluenceToGithub({
            confluenceSdk,
            githubClient,
            mapping,
            pages: [{ pageId: 12345, pagePath: 'docs/test-page' }],
            confluenceHost: 'https://acme.atlassian.net',
            spaceKey: 'ENG'
        });

        expect(stats.created).to.equal(0);
        expect(githubClient.addComment.called).to.be.false;
    });

    it('should update a GH comment when Confluence content changed', async () => {
        confluenceSdk.getComments.resolves([
            {
                id: '100',
                body: { storage: { value: '<p>Updated content</p>' } },
                version: { number: 2 }
            }
        ]);
        githubClient.getDiscussionComments.resolves([
            {
                id: 'gh-1',
                body: 'Old content\n\n<!-- confluence-comment-id:100 -->\n<!-- body-checksum:stale_hash -->',
                author: 'bot',
                createdAt: '2025-01-01',
                updatedAt: '2025-01-01'
            }
        ]);

        const stats = await syncConfluenceToGithub({
            confluenceSdk,
            githubClient,
            mapping,
            pages: [{ pageId: 12345, pagePath: 'docs/test-page' }],
            confluenceHost: 'https://acme.atlassian.net',
            spaceKey: 'ENG'
        });

        expect(stats.updated).to.equal(1);
        expect(githubClient.updateComment.calledOnce).to.be.true;
        const body = githubClient.updateComment.firstCall.args[1];
        expect(body).to.include('Synced from Confluence');
        expect(body).to.include('View original comment');
    });

    it('should skip unchanged comments', async () => {
        const { computeChecksum } = await import('../../../lib/comment-sync/markers.js');
        const { htmlToMarkdown } = await import('../../../lib/comment-sync/html-to-markdown.js');
        const html = '<p>Same content</p>';
        const md = htmlToMarkdown(html);
        const checksum = computeChecksum(md);

        confluenceSdk.getComments.resolves([
            {
                id: '100',
                body: { storage: { value: html } },
                version: { number: 1 }
            }
        ]);
        githubClient.getDiscussionComments.resolves([
            {
                id: 'gh-1',
                body: `Same content\n\n<!-- confluence-comment-id:100 -->\n<!-- body-checksum:${checksum} -->`,
                author: 'bot',
                createdAt: '2025-01-01',
                updatedAt: '2025-01-01'
            }
        ]);

        const stats = await syncConfluenceToGithub({
            confluenceSdk,
            githubClient,
            mapping,
            pages: [{ pageId: 12345, pagePath: 'docs/test-page' }],
            confluenceHost: 'https://acme.atlassian.net',
            spaceKey: 'ENG'
        });

        expect(stats.created).to.equal(0);
        expect(stats.updated).to.equal(0);
    });

    it('should label deleted Confluence comments', async () => {
        confluenceSdk.getComments.resolves([]);
        githubClient.getDiscussionComments.resolves([
            {
                id: 'gh-1',
                body: 'Stale comment\n\n<!-- confluence-comment-id:999 -->\n<!-- body-checksum:abc -->',
                author: 'bot',
                createdAt: '2025-01-01',
                updatedAt: '2025-01-01'
            }
        ]);

        const stats = await syncConfluenceToGithub({
            confluenceSdk,
            githubClient,
            mapping,
            pages: [{ pageId: 12345, pagePath: 'docs/test-page' }],
            confluenceHost: 'https://acme.atlassian.net',
            spaceKey: 'ENG'
        });

        expect(stats.deleted).to.equal(1);
        expect(githubClient.addLabel.calledWith('disc-node-1', 'deleted-on-confluence')).to.be.true;
    });
});
