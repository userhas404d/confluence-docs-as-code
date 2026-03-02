import { expect } from 'chai';
import { convertAdf, createContext } from '../../../lib/pull/adf-converter.js';
import { registerHandler, convertNode, handlers } from '../../../lib/pull/adf-nodes/index.js';

describe('adf-converter', () => {
    afterEach(() => {
        // Clean up test handlers
        handlers.clear();
    });

    describe('convertAdf', () => {
        it('should dispatch to registered handlers by node type', () => {
            registerHandler('paragraph', (node, ctx) => {
                return 'paragraph-output\n';
            });

            const adf = {
                version: 1,
                type: 'doc',
                content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }
                ]
            };

            const result = convertAdf(adf, createContext());
            expect(result).to.equal('paragraph-output\n');
        });

        it('should handle JSON string input', () => {
            registerHandler('paragraph', () => 'parsed\n');

            const adfStr = JSON.stringify({
                version: 1,
                type: 'doc',
                content: [{ type: 'paragraph', content: [] }]
            });

            const result = convertAdf(adfStr, createContext());
            expect(result).to.equal('parsed\n');
        });

        it('should return empty string for empty page (no content)', () => {
            const adf = { version: 1, type: 'doc', content: [] };
            expect(convertAdf(adf, createContext())).to.equal('');
        });

        it('should return empty string for null content', () => {
            const adf = { version: 1, type: 'doc' };
            expect(convertAdf(adf, createContext())).to.equal('');
        });

        it('should fallback to raw JSON code block on parse failure', () => {
            const result = convertAdf('{invalid json!!', createContext());
            expect(result).to.include('```json');
            expect(result).to.include('{invalid json!!');
        });

        it('should handle multiple content nodes', () => {
            registerHandler('paragraph', () => 'p\n');
            registerHandler('heading', () => '## h\n');

            const adf = {
                version: 1,
                type: 'doc',
                content: [
                    { type: 'paragraph', content: [] },
                    { type: 'heading', attrs: { level: 2 }, content: [] }
                ]
            };

            const result = convertAdf(adf, createContext());
            expect(result).to.equal('p\n\n## h\n');
        });
    });

    describe('unknown node handling', () => {
        it('should emit HTML comment for unknown leaf nodes', () => {
            const adf = {
                version: 1,
                type: 'doc',
                content: [{ type: 'unknownType' }]
            };

            const result = convertAdf(adf, createContext());
            expect(result).to.include('<!-- Unknown ADF node: unknownType -->');
        });

        it('should try to process children of unknown container nodes', () => {
            registerHandler('text', (node) => node.text || '');

            const adf = {
                version: 1,
                type: 'doc',
                content: [{
                    type: 'unknownContainer',
                    content: [{ type: 'text', text: 'child content' }]
                }]
            };

            const result = convertAdf(adf, createContext());
            expect(result).to.include('child content');
        });
    });
});

describe('adf-nodes/index (registry)', () => {
    afterEach(() => {
        handlers.clear();
    });

    it('should register and retrieve handlers', () => {
        const handler = () => 'test';
        registerHandler('testType', handler);
        expect(handlers.get('testType')).to.equal(handler);
    });

    it('should return empty string for null node', () => {
        expect(convertNode(null, {})).to.equal('');
    });

    it('should silently skip extension macros like toc and children', () => {
        const tocNode = {
            type: 'extension',
            attrs: { extensionKey: 'toc', extensionType: 'com.atlassian.confluence' }
        };
        expect(convertNode(tocNode, {})).to.equal('');

        const childrenNode = {
            type: 'bodiedExtension',
            attrs: { extensionKey: 'children', extensionType: 'com.atlassian.confluence' }
        };
        expect(convertNode(childrenNode, {})).to.equal('');
    });
});
