import { expect } from 'chai';

/**
 * T011: Tests for slug utility
 */
describe('slug', () => {
    let slugify;

    beforeEach(async () => {
        const mod = await import('../../../lib/pull/slug.js');
        slugify = mod.slugify;
    });

    it('should convert spaces to hyphens', () => {
        expect(slugify('Getting Started')).to.equal('getting-started');
    });

    it('should convert to lowercase', () => {
        expect(slugify('UPPERCASE TITLE')).to.equal('uppercase-title');
    });

    it('should remove special characters', () => {
        expect(slugify('Teleport Overview & Setup')).to.equal('teleport-overview-setup');
    });

    it('should remove parentheses and their content markers', () => {
        expect(slugify('FAQ (Frequently Asked)')).to.equal('faq-frequently-asked');
    });

    it('should handle em dashes and special dashes', () => {
        expect(slugify('Version 2.0 — Release Notes')).to.equal('version-20-release-notes');
    });

    it('should handle emoji characters', () => {
        expect(slugify('🚀 Launch Guide')).to.equal('launch-guide');
    });

    it('should collapse consecutive hyphens', () => {
        expect(slugify('foo---bar')).to.equal('foo-bar');
    });

    it('should trim leading and trailing hyphens', () => {
        expect(slugify('--hello--')).to.equal('hello');
    });

    it('should handle colons', () => {
        expect(slugify('Step 1: Install')).to.equal('step-1-install');
    });

    describe('duplicate slug collision', () => {
        let resolveSlug;

        beforeEach(async () => {
            const mod = await import('../../../lib/pull/slug.js');
            resolveSlug = mod.resolveSlug;
        });

        it('should return slug unchanged when no collision', () => {
            const used = new Set();
            expect(resolveSlug('getting-started', used)).to.equal('getting-started');
        });

        it('should append -2 suffix on first collision', () => {
            const used = new Set(['getting-started']);
            expect(resolveSlug('getting-started', used)).to.equal('getting-started-2');
        });

        it('should increment suffix on subsequent collisions', () => {
            const used = new Set(['getting-started', 'getting-started-2']);
            expect(resolveSlug('getting-started', used)).to.equal('getting-started-3');
        });
    });
});
