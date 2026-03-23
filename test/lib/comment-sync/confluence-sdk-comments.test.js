import { expect } from 'chai';
import sinon from 'sinon';
import nock from 'nock';
import ConfluenceSdk from '../../../lib/confluence-sdk.js';
import logger from '../../../lib/logger.js';

const sdkOpts = {
    host: 'https://tenant.atlassian.net',
    user: 'foo@bar.com',
    token: 'testtoken',
    spaceKey: '~SpaCek3y',
    pageLimit: 25
};
const basePath = '/wiki/rest/api/content';
const sandbox = sinon.createSandbox();

describe('confluence-sdk comment methods', () => {
    let sdk;

    beforeEach(() => {
        sdk = new ConfluenceSdk(sdkOpts);
        sandbox.stub(logger, 'error');
    });

    afterEach(() => {
        sandbox.restore();
        nock.cleanAll();
    });

    describe('getComments', () => {
        it('should fetch comments for a page', async () => {
            const pageId = 12345;
            const commentData = {
                results: [
                    {
                        id: '100',
                        body: { storage: { value: '<p>A comment</p>' } },
                        version: { number: 1 }
                    },
                    {
                        id: '101',
                        body: { storage: { value: '<p>Another comment</p>' } },
                        version: { number: 2 }
                    }
                ],
                _links: {}
            };

            nock(sdkOpts.host)
                .get(new RegExp(`${basePath}/${pageId}/child/comment`))
                .reply(200, commentData);

            const comments = await sdk.getComments(pageId);
            expect(comments).to.have.lengthOf(2);
            expect(comments[0].id).to.equal('100');
            expect(comments[1].id).to.equal('101');
        });

        it('should paginate through comments', async () => {
            const pageId = 12345;
            const page1 = {
                results: [{ id: '100', body: { storage: { value: 'c1' } }, version: { number: 1 } }],
                _links: {
                    context: '',
                    next: `${basePath}/${pageId}/child/comment?start=1`
                }
            };
            const page2 = {
                results: [{ id: '101', body: { storage: { value: 'c2' } }, version: { number: 1 } }],
                _links: {}
            };

            nock(sdkOpts.host)
                .get(new RegExp(`${basePath}/${pageId}/child/comment\\?expand`))
                .reply(200, page1)
                .get(new RegExp(`${basePath}/${pageId}/child/comment\\?start=1`))
                .reply(200, page2);

            const comments = await sdk.getComments(pageId);
            expect(comments).to.have.lengthOf(2);
        });
    });

    describe('createComment', () => {
        it('should create a comment on a page', async () => {
            const pageId = 12345;
            const body = '<p>New comment</p>';

            nock(sdkOpts.host)
                .post(basePath, (reqBody) => {
                    return reqBody.type === 'comment'
                        && reqBody.container.id === String(pageId)
                        && reqBody.body.storage.value === body;
                })
                .reply(200, { id: '200', type: 'comment' });

            const result = await sdk.createComment(pageId, body);
            expect(result.id).to.equal('200');
        });
    });

    describe('updateComment', () => {
        it('should update an existing comment', async () => {
            const commentId = 100;
            const version = 1;
            const body = '<p>Updated comment</p>';

            nock(sdkOpts.host)
                .put(`${basePath}/${commentId}`, (reqBody) => {
                    return reqBody.type === 'comment'
                        && reqBody.version.number === version + 1
                        && reqBody.body.storage.value === body;
                })
                .reply(200, { id: String(commentId), type: 'comment' });

            const result = await sdk.updateComment(commentId, version, body);
            expect(result.id).to.equal(String(commentId));
        });
    });
});
