import { expect } from 'chai';
import sinon from 'sinon';
import { syncGithubCommentToConfluence } from '../../../lib/comment-sync/github-to-confluence.js';
import logger from '../../../lib/logger.js';

const sandbox = sinon.createSandbox();

describe('comment-sync/github-to-confluence', () => {
    let confluenceSdk;

    beforeEach(() => {
        sandbox.stub(logger, 'info');
        sandbox.stub(logger, 'debug');
        sandbox.stub(logger, 'warn');

        confluenceSdk = {
            getComments: sandbox.stub(),
            createComment: sandbox.stub().resolves({ id: '200' }),
            updateComment: sandbox.stub().resolves({ id: '100' })
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should create a Confluence comment for a new GH comment', async () => {
        confluenceSdk.getComments.resolves([]);

        const result = await syncGithubCommentToConfluence({
            confluenceSdk,
            comment: { node_id: 'gh-node-1', body: 'Hello from GitHub' },
            pageId: 12345
        });

        expect(result.action).to.equal('created');
        expect(result.commentId).to.equal('200');
        expect(confluenceSdk.createComment.calledOnce).to.be.true;
        const htmlBody = confluenceSdk.createComment.firstCall.args[1];
        expect(htmlBody).to.include('github-discussion-comment-id:gh-node-1');
    });

    it('should skip comments that originated from Confluence', async () => {
        const result = await syncGithubCommentToConfluence({
            confluenceSdk,
            comment: {
                node_id: 'gh-node-2',
                body: 'Mirror\n\n<!-- confluence-comment-id:50 -->\n<!-- body-checksum:abc -->'
            },
            pageId: 12345
        });

        expect(result.action).to.equal('skipped');
        expect(confluenceSdk.getComments.called).to.be.false;
    });

    it('should update an existing Confluence comment when content changed', async () => {
        confluenceSdk.getComments.resolves([
            {
                id: '100',
                body: {
                    storage: {
                        value: '<p>Old</p>\n<!-- github-discussion-comment-id:gh-node-3 -->\n<!-- body-checksum:old_hash -->'
                    }
                },
                version: { number: 1 }
            }
        ]);

        const result = await syncGithubCommentToConfluence({
            confluenceSdk,
            comment: { node_id: 'gh-node-3', body: 'Updated text from GitHub' },
            pageId: 12345
        });

        expect(result.action).to.equal('updated');
        expect(confluenceSdk.updateComment.calledOnce).to.be.true;
    });

    it('should skip unchanged comments', async () => {
        const { computeChecksum } = await import('../../../lib/comment-sync/markers.js');
        const body = 'Same content';
        const checksum = computeChecksum(body);

        confluenceSdk.getComments.resolves([
            {
                id: '100',
                body: {
                    storage: {
                        value: `<p>Same content</p>\n<!-- github-discussion-comment-id:gh-node-4 -->\n<!-- body-checksum:${checksum} -->`
                    }
                },
                version: { number: 1 }
            }
        ]);

        const result = await syncGithubCommentToConfluence({
            confluenceSdk,
            comment: { node_id: 'gh-node-4', body },
            pageId: 12345
        });

        expect(result.action).to.equal('skipped');
        expect(confluenceSdk.updateComment.called).to.be.false;
    });
});
