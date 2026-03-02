import { expect } from 'chai';

describe('link-resolver', () => {
    let buildPageSlugMap, extractPageIdFromUrl, resolveLink, relativize;

    beforeEach(async () => {
        const mod = await import('../../../lib/pull/link-resolver.js');
        buildPageSlugMap = mod.buildPageSlugMap;
        extractPageIdFromUrl = mod.extractPageIdFromUrl;
        resolveLink = mod.resolveLink;
        relativize = mod.relativize;
    });

    describe('buildPageSlugMap', () => {
        it('should build map from page tree', () => {
            const tree = {
                id: '100', slug: 'index', outputPath: 'index.md',
                children: [
                    { id: '200', slug: 'getting-started', outputPath: 'getting-started.md', children: [] },
                    {
                        id: '201', slug: 'architecture', outputPath: 'architecture/index.md',
                        children: [
                            { id: '300', slug: 'system-design', outputPath: 'architecture/system-design.md', children: [] }
                        ]
                    }
                ]
            };
            const map = buildPageSlugMap(tree);
            expect(map.get('100')).to.equal('index.md');
            expect(map.get('200')).to.equal('getting-started.md');
            expect(map.get('201')).to.equal('architecture/index.md');
            expect(map.get('300')).to.equal('architecture/system-design.md');
        });
    });

    describe('extractPageIdFromUrl', () => {
        it('should extract page ID from /wiki/spaces/{key}/pages/{id}/{title} pattern', () => {
            const url = 'https://leolabs.atlassian.net/wiki/spaces/TEL/pages/2134835234/Getting+Started';
            expect(extractPageIdFromUrl(url)).to.equal('2134835234');
        });

        it('should extract page ID from /wiki/spaces/{key}/pages/{id} pattern (no title)', () => {
            const url = 'https://leolabs.atlassian.net/wiki/spaces/TEL/pages/12345';
            expect(extractPageIdFromUrl(url)).to.equal('12345');
        });

        it('should handle URL with trailing slash', () => {
            const url = 'https://leolabs.atlassian.net/wiki/spaces/TEL/pages/99999/';
            expect(extractPageIdFromUrl(url)).to.equal('99999');
        });

        it('should return null for non-Confluence URLs', () => {
            expect(extractPageIdFromUrl('https://github.com/repo')).to.be.null;
        });

        it('should return null for shortlink URLs', () => {
            expect(extractPageIdFromUrl('https://leolabs.atlassian.net/wiki/x/abc123')).to.be.null;
        });
    });

    describe('resolveLink', () => {
        it('should resolve internal Confluence link to relative path', () => {
            const pageSlugMap = new Map([
                ['2134835234', 'getting-started.md']
            ]);
            const url = 'https://leolabs.atlassian.net/wiki/spaces/TEL/pages/2134835234/Getting+Started';
            const result = resolveLink(url, pageSlugMap);
            expect(result).to.equal('getting-started.md');
        });

        it('should passthrough external URLs', () => {
            const pageSlugMap = new Map();
            const url = 'https://github.com/repo';
            expect(resolveLink(url, pageSlugMap)).to.equal('https://github.com/repo');
        });

        it('should passthrough Confluence links to pages not in tree', () => {
            const pageSlugMap = new Map();
            const url = 'https://leolabs.atlassian.net/wiki/spaces/TEL/pages/99999/Unknown';
            expect(resolveLink(url, pageSlugMap)).to.equal(url);
        });
    });

    describe('relativize', () => {
        it('should return target unchanged when current page is at docs root', () => {
            expect(relativize('images/foo.png', 'index.md')).to.equal('images/foo.png');
        });

        it('should add ../ for image paths when page is in a subdirectory', () => {
            expect(relativize('images/foo.png', 'teleport-and-aws/index.md'))
                .to.equal('../images/foo.png');
        });

        it('should return just filename for sibling pages in same directory', () => {
            expect(relativize('teleport-and-aws/child.md', 'teleport-and-aws/index.md'))
                .to.equal('child.md');
        });

        it('should add ../ for cross-level links from subdirectory to root', () => {
            expect(relativize('teleport-access-requests.md', 'teleport-and-aws/index.md'))
                .to.equal('../teleport-access-requests.md');
        });

        it('should navigate between sibling directories', () => {
            expect(relativize('teleport-and-databases/index.md', 'teleport-and-aws/index.md'))
                .to.equal('../teleport-and-databases/index.md');
        });

        it('should passthrough absolute URLs', () => {
            expect(relativize('https://example.com', 'teleport-and-aws/index.md'))
                .to.equal('https://example.com');
        });

        it('should passthrough anchors', () => {
            expect(relativize('#section', 'teleport-and-aws/index.md'))
                .to.equal('#section');
        });

        it('should handle empty currentOutputPath', () => {
            expect(relativize('images/foo.png', '')).to.equal('images/foo.png');
        });

        it('should handle target in subdirectory from root page', () => {
            expect(relativize('teleport-and-aws/index.md', 'index.md'))
                .to.equal('teleport-and-aws/index.md');
        });
    });
});
