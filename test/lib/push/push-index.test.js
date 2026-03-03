import { expect } from 'chai';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Tests for push CLI entry point helper functions.
 * The main() function is not tested here because it calls process.exit()
 * and dynamically imports modules with side effects. Instead, we test
 * the exported helper functions in isolation.
 */
describe('push/index helpers', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = path.join(os.tmpdir(), `push-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('ensureRepoUrl', () => {
        let ensureRepoUrl;

        beforeEach(async () => {
            const mod = await import('../../../lib/push/index.js');
            ensureRepoUrl = mod.ensureRepoUrl;
        });

        it('should pass when repo_url already exists in mkdocs.yml', () => {
            const content = 'site_name: Test\nrepo_url: https://github.com/org/repo\nnav:\n  - Home: index.md\n';
            writeFileSync(path.join(tmpDir, 'mkdocs.yml'), content);

            expect(() => ensureRepoUrl(tmpDir, undefined)).to.not.throw();

            // Should not modify the file
            const result = readFileSync(path.join(tmpDir, 'mkdocs.yml'), 'utf8');
            expect(result).to.equal(content);
        });

        it('should inject repo_url when missing and repoUrl is provided', () => {
            const content = 'site_name: Test\nnav:\n  - Home: index.md\n';
            writeFileSync(path.join(tmpDir, 'mkdocs.yml'), content);

            ensureRepoUrl(tmpDir, 'https://github.com/org/repo');

            const result = readFileSync(path.join(tmpDir, 'mkdocs.yml'), 'utf8');
            expect(result).to.include('repo_url: https://github.com/org/repo');
            // Should be injected after site_name
            expect(result.indexOf('repo_url')).to.be.greaterThan(result.indexOf('site_name'));
        });

        it('should throw when repo_url is missing and no fallback is provided', () => {
            const content = 'site_name: Test\nnav:\n  - Home: index.md\n';
            writeFileSync(path.join(tmpDir, 'mkdocs.yml'), content);

            expect(() => ensureRepoUrl(tmpDir, undefined)).to.throw('repo_url is missing');
        });

        it('should throw when mkdocs.yml does not exist', () => {
            expect(() => ensureRepoUrl(tmpDir, 'https://github.com/org/repo')).to.throw('mkdocs.yml not found');
        });

        it('should handle repo_url with indented content', () => {
            const content = 'site_name: My Docs\ntheme:\n  name: material\nnav:\n  - Home: index.md\n';
            writeFileSync(path.join(tmpDir, 'mkdocs.yml'), content);

            ensureRepoUrl(tmpDir, 'https://github.com/org/repo');

            const result = readFileSync(path.join(tmpDir, 'mkdocs.yml'), 'utf8');
            expect(result).to.include('repo_url: https://github.com/org/repo');
        });

        it('should not inject duplicate repo_url if already present with spaces', () => {
            const content = 'site_name: Test\nrepo_url:   https://github.com/org/repo  \nnav:\n  - Home: index.md\n';
            writeFileSync(path.join(tmpDir, 'mkdocs.yml'), content);

            ensureRepoUrl(tmpDir, 'https://github.com/other/repo');

            const result = readFileSync(path.join(tmpDir, 'mkdocs.yml'), 'utf8');
            // Should not add a second repo_url
            const matches = result.match(/repo_url/g);
            expect(matches).to.have.lengthOf(1);
        });
    });
});
