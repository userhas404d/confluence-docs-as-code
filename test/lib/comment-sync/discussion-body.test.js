import { expect } from 'chai';
import { buildDiscussionBody, refreshTimestamp } from '../../../lib/comment-sync/discussion-body.js';

describe('comment-sync/discussion-body', () => {
    const baseOpts = {
        pagePath: 'docs/getting-started',
        confluenceHost: 'https://acme.atlassian.net',
        spaceKey: 'ENG',
        pageId: 12345,
        owner: 'acme',
        repo: 'docs',
        lastSynced: new Date('2025-06-15T12:00:00Z')
    };

    describe('buildDiscussionBody', () => {
        it('should include the last synced timestamp', () => {
            const body = buildDiscussionBody(baseOpts);
            expect(body).to.include('**Last synced:** 2025-06-15T12:00:00.000Z');
        });

        it('should include a link to manually run the workflow', () => {
            const body = buildDiscussionBody(baseOpts);
            expect(body).to.include('https://github.com/acme/docs/actions/workflows/comment-sync.yml');
            expect(body).to.include('Run comment sync manually');
        });

        it('should include a link to the Confluence page', () => {
            const body = buildDiscussionBody(baseOpts);
            expect(body).to.include('https://acme.atlassian.net/wiki/spaces/ENG/pages/12345');
        });

        it('should include the sync process overview table', () => {
            const body = buildDiscussionBody(baseOpts);
            expect(body).to.include('Confluence → GitHub');
            expect(body).to.include('GitHub → Confluence');
            expect(body).to.include('Scheduled poll');
        });

        it('should default lastSynced to now when not provided', () => {
            const before = new Date();
            const body = buildDiscussionBody({ ...baseOpts, lastSynced: undefined });
            const after = new Date();
            const match = body.match(/\*\*Last synced:\*\* (.+)/);
            expect(match).to.not.be.null;
            const ts = new Date(match[1]);
            expect(ts.getTime()).to.be.at.least(before.getTime());
            expect(ts.getTime()).to.be.at.most(after.getTime());
        });
    });

    describe('refreshTimestamp', () => {
        it('should update the timestamp in an existing body', () => {
            const body = buildDiscussionBody(baseOpts);
            const newTime = new Date('2025-07-01T08:30:00Z');
            const updated = refreshTimestamp(body, newTime);
            expect(updated).to.include('**Last synced:** 2025-07-01T08:30:00.000Z');
            expect(updated).to.not.include('2025-06-15T12:00:00.000Z');
        });

        it('should preserve the rest of the body', () => {
            const body = buildDiscussionBody(baseOpts);
            const updated = refreshTimestamp(body, new Date('2025-07-01T00:00:00Z'));
            expect(updated).to.include('Run comment sync manually');
            expect(updated).to.include('Confluence page');
            expect(updated).to.include('How comment sync works');
        });

        it('should return body unchanged if no timestamp marker found', () => {
            const plain = 'Just a plain Discussion body with no markers.';
            const result = refreshTimestamp(plain, new Date());
            expect(result).to.equal(plain);
        });
    });
});
