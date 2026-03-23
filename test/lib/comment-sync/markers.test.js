import { expect } from 'chai';
import {
    extractConfluenceId,
    extractGithubId,
    extractChecksum,
    computeChecksum,
    stripMarkers,
    buildMarkers
} from '../../../lib/comment-sync/markers.js';

describe('comment-sync/markers', () => {

    describe('extractConfluenceId', () => {
        it('should extract a Confluence comment ID from text', () => {
            const text = 'Some comment\n<!-- confluence-comment-id:12345 -->';
            expect(extractConfluenceId(text)).to.equal('12345');
        });

        it('should return null when no marker present', () => {
            expect(extractConfluenceId('just some text')).to.be.null;
        });

        it('should return null for null/undefined input', () => {
            expect(extractConfluenceId(null)).to.be.null;
            expect(extractConfluenceId(undefined)).to.be.null;
        });
    });

    describe('extractGithubId', () => {
        it('should extract a GitHub Discussion comment ID from text', () => {
            const text = 'Comment body\n<!-- github-discussion-comment-id:MDEyOkFiYz -->';
            expect(extractGithubId(text)).to.equal('MDEyOkFiYz');
        });

        it('should return null when no marker present', () => {
            expect(extractGithubId('no marker here')).to.be.null;
        });
    });

    describe('extractChecksum', () => {
        it('should extract a body checksum from text', () => {
            const text = 'Comment\n<!-- body-checksum:abc123def456 -->';
            expect(extractChecksum(text)).to.equal('abc123def456');
        });

        it('should return null when no checksum present', () => {
            expect(extractChecksum('no checksum')).to.be.null;
        });
    });

    describe('computeChecksum', () => {
        it('should compute a consistent SHA-256 hex digest', () => {
            const body = 'Hello, world!';
            const hash1 = computeChecksum(body);
            const hash2 = computeChecksum(body);
            expect(hash1).to.equal(hash2);
            expect(hash1).to.match(/^[a-f0-9]{64}$/);
        });

        it('should strip markers before computing', () => {
            const body = 'Hello\n<!-- confluence-comment-id:99 -->\n<!-- body-checksum:old123 -->';
            const clean = stripMarkers(body);
            expect(computeChecksum(body)).to.equal(computeChecksum(clean));
        });

        it('should produce different hashes for different content', () => {
            expect(computeChecksum('aaa')).to.not.equal(computeChecksum('bbb'));
        });
    });

    describe('stripMarkers', () => {
        it('should remove all marker comments', () => {
            const text = [
                'Real content here',
                '<!-- confluence-comment-id:123 -->',
                '<!-- github-discussion-comment-id:abc -->',
                '<!-- body-checksum:def -->'
            ].join('\n');
            expect(stripMarkers(text)).to.equal('Real content here');
        });

        it('should handle empty input', () => {
            expect(stripMarkers('')).to.equal('');
            expect(stripMarkers(null)).to.equal('');
        });
    });

    describe('buildMarkers', () => {
        it('should build confluence-origin markers', () => {
            const result = buildMarkers('confluence', '12345', 'abc');
            expect(result).to.include('confluence-comment-id:12345');
            expect(result).to.include('body-checksum:abc');
        });

        it('should build github-origin markers', () => {
            const result = buildMarkers('github', 'MDEyOk', 'xyz');
            expect(result).to.include('github-discussion-comment-id:MDEyOk');
            expect(result).to.include('body-checksum:xyz');
        });
    });
});
