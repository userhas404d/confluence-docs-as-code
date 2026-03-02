import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/inline-card', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/inline-card.js');
    });

    describe('inlineCard', () => {
        it('should convert internal page link to relative .md path', () => {
            const ctx = {
                depth: 0,
                pageSlugMap: new Map([
                    ['12345', 'getting-started.md']
                ]),
                pageTitleMap: new Map([
                    ['12345', 'Getting Started']
                ])
            };
            const node = {
                type: 'inlineCard',
                attrs: {
                    url: 'https://leolabs.atlassian.net/wiki/spaces/TEL/pages/12345/Getting+Started'
                }
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('[Getting Started](getting-started.md)');
        });

        it('should use pageTitleMap when URL has no title segment', () => {
            const ctx = {
                depth: 0,
                pageSlugMap: new Map([
                    ['2134999084', 'teleport-and-aws/index.md']
                ]),
                pageTitleMap: new Map([
                    ['2134999084', 'Teleport and AWS']
                ])
            };
            const node = {
                type: 'inlineCard',
                attrs: {
                    url: 'https://leolabs.atlassian.net/wiki/spaces/intinfra/pages/2134999084'
                }
            };
            const result = convertNode(node, ctx);
            expect(result).to.equal('[Teleport and AWS](teleport-and-aws/index.md)');
        });

        it('should preserve external URLs as absolute links', () => {
            const ctx = {
                depth: 0,
                pageSlugMap: new Map()
            };
            const node = {
                type: 'inlineCard',
                attrs: {
                    url: 'https://github.com/org/repo'
                }
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('https://github.com/org/repo');
        });

        it('should handle Confluence link not in page tree', () => {
            const ctx = {
                depth: 0,
                pageSlugMap: new Map()
            };
            const node = {
                type: 'inlineCard',
                attrs: {
                    url: 'https://leolabs.atlassian.net/wiki/spaces/OTHER/pages/99999/Unknown'
                }
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('https://leolabs.atlassian.net');
        });
        it('should relativize paths when page is in a subdirectory', () => {
            const ctx = {
                depth: 0,
                currentOutputPath: 'teleport-and-aws/index.md',
                pageSlugMap: new Map([
                    ['99999', 'teleport-access-requests.md']
                ]),
                pageTitleMap: new Map([
                    ['99999', 'Teleport Access Requests']
                ])
            };
            const node = {
                type: 'inlineCard',
                attrs: {
                    url: 'https://leolabs.atlassian.net/wiki/spaces/intinfra/pages/99999'
                }
            };
            const result = convertNode(node, ctx);
            expect(result).to.equal('[Teleport Access Requests](../teleport-access-requests.md)');
        });
    });

    describe('embedCard', () => {
        it('should convert embedCard to standard link', () => {
            const ctx = {
                depth: 0,
                pageSlugMap: new Map([
                    ['55555', 'architecture/index.md']
                ])
            };
            const node = {
                type: 'embedCard',
                attrs: {
                    url: 'https://leolabs.atlassian.net/wiki/spaces/TEL/pages/55555/Architecture'
                }
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('[Architecture](architecture/index.md)');
        });
    });
});
