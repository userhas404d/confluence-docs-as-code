import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('pull-manifest', () => {
    let loadManifest, saveManifest, createManifest, isPageChanged, buildPageEntry, findRemovedPages, MANIFEST_FILENAME;
    let tmpDir;

    beforeEach(async () => {
        const mod = await import('../../../lib/pull/pull-manifest.js');
        loadManifest = mod.loadManifest;
        saveManifest = mod.saveManifest;
        createManifest = mod.createManifest;
        isPageChanged = mod.isPageChanged;
        buildPageEntry = mod.buildPageEntry;
        findRemovedPages = mod.findRemovedPages;
        MANIFEST_FILENAME = mod.MANIFEST_FILENAME;

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('createManifest', () => {
        it('should create a fresh manifest with schema version 1', () => {
            const manifest = createManifest('12345');
            expect(manifest.schemaVersion).to.equal(1);
            expect(manifest.rootPageId).to.equal('12345');
            expect(manifest.pulledAt).to.be.a('string');
            expect(manifest.pages).to.deep.equal({});
        });
    });

    describe('saveManifest and loadManifest', () => {
        it('should round-trip a manifest to disk', () => {
            const manifest = createManifest('100');
            manifest.pages['100'] = buildPageEntry('100', 'Root', 5, 'index.md', ['img.png']);

            saveManifest(tmpDir, manifest);

            const loaded = loadManifest(tmpDir);
            expect(loaded).to.not.be.null;
            expect(loaded.schemaVersion).to.equal(1);
            expect(loaded.rootPageId).to.equal('100');
            expect(loaded.pages['100'].title).to.equal('Root');
            expect(loaded.pages['100'].version).to.equal(5);
            expect(loaded.pages['100'].attachments).to.deep.equal(['img.png']);
        });

        it('should return null when no manifest file exists', () => {
            const loaded = loadManifest(tmpDir);
            expect(loaded).to.be.null;
        });

        it('should return null for invalid JSON', () => {
            fs.writeFileSync(path.join(tmpDir, MANIFEST_FILENAME), 'not json', 'utf-8');
            const loaded = loadManifest(tmpDir);
            expect(loaded).to.be.null;
        });

        it('should return null for wrong schema version', () => {
            const bad = { schemaVersion: 999, rootPageId: '1', pages: {} };
            fs.writeFileSync(path.join(tmpDir, MANIFEST_FILENAME), JSON.stringify(bad), 'utf-8');
            const loaded = loadManifest(tmpDir);
            expect(loaded).to.be.null;
        });
    });

    describe('isPageChanged', () => {
        const manifest = {
            schemaVersion: 1,
            rootPageId: '100',
            pulledAt: new Date().toISOString(),
            pages: {
                '100': { pageId: '100', title: 'Root', version: 3, outputPath: 'index.md', attachments: [] },
                '200': { pageId: '200', title: 'Getting Started', version: 5, outputPath: 'getting-started.md', attachments: [] }
            }
        };

        it('should return true when manifest is null', () => {
            expect(isPageChanged(null, '100', 3, 'Root')).to.be.true;
        });

        it('should return true when page is not in manifest', () => {
            expect(isPageChanged(manifest, '999', 1, 'New Page')).to.be.true;
        });

        it('should return true when version has increased', () => {
            expect(isPageChanged(manifest, '100', 4, 'Root')).to.be.true;
        });

        it('should return true when title has changed', () => {
            expect(isPageChanged(manifest, '100', 3, 'Root Page Renamed')).to.be.true;
        });

        it('should return false when version and title are unchanged', () => {
            expect(isPageChanged(manifest, '100', 3, 'Root')).to.be.false;
        });

        it('should return false when version is the same for another page', () => {
            expect(isPageChanged(manifest, '200', 5, 'Getting Started')).to.be.false;
        });
    });

    describe('buildPageEntry', () => {
        it('should create a well-formed entry object', () => {
            const entry = buildPageEntry('100', 'My Page', 7, 'my-page.md', ['img1.png', 'img2.png']);
            expect(entry).to.deep.equal({
                pageId: '100',
                title: 'My Page',
                version: 7,
                outputPath: 'my-page.md',
                attachments: ['img1.png', 'img2.png']
            });
        });
    });

    describe('findRemovedPages', () => {
        it('should return empty array when no old manifest', () => {
            const removed = findRemovedPages(null, new Set(['100']));
            expect(removed).to.be.an('array').that.is.empty;
        });

        it('should return entries for pages no longer in the tree', () => {
            const oldManifest = {
                schemaVersion: 1,
                rootPageId: '100',
                pulledAt: new Date().toISOString(),
                pages: {
                    '100': { pageId: '100', title: 'Root', version: 1, outputPath: 'index.md', attachments: [] },
                    '200': { pageId: '200', title: 'Deleted', version: 2, outputPath: 'deleted.md', attachments: ['img.png'] },
                    '300': { pageId: '300', title: 'Still Here', version: 1, outputPath: 'still-here.md', attachments: [] }
                }
            };

            const currentIds = new Set(['100', '300']);
            const removed = findRemovedPages(oldManifest, currentIds);

            expect(removed).to.have.lengthOf(1);
            expect(removed[0].pageId).to.equal('200');
            expect(removed[0].title).to.equal('Deleted');
        });

        it('should return empty when all pages still exist', () => {
            const oldManifest = {
                schemaVersion: 1,
                rootPageId: '100',
                pulledAt: new Date().toISOString(),
                pages: {
                    '100': { pageId: '100', title: 'Root', version: 1, outputPath: 'index.md', attachments: [] }
                }
            };

            const removed = findRemovedPages(oldManifest, new Set(['100']));
            expect(removed).to.be.an('array').that.is.empty;
        });
    });
});
