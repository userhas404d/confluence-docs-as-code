import { expect } from 'chai';
import { registerHandler, handlers, convertNode, convertChildren } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/paragraph', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
    });

    // Note: No handlers.clear() — ESM module cache prevents re-registration

    const ctx = { depth: 0, listType: null, inlineMode: false };

    describe('paragraph', () => {
        it('should convert paragraph with text content', () => {
            const node = {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Hello world' }]
            };
            expect(convertNode(node, ctx)).to.equal('Hello world\n');
        });

        it('should convert empty paragraph to blank line', () => {
            const node = { type: 'paragraph', content: [] };
            expect(convertNode(node, ctx)).to.equal('\n');
        });
    });

    describe('heading', () => {
        it('should convert heading level 1', () => {
            const node = {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Title' }]
            };
            expect(convertNode(node, ctx)).to.equal('# Title\n');
        });

        it('should convert heading level 2', () => {
            const node = {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Subtitle' }]
            };
            expect(convertNode(node, ctx)).to.equal('## Subtitle\n');
        });

        it('should convert heading level 3-6', () => {
            for (let level = 3; level <= 6; level++) {
                const node = {
                    type: 'heading',
                    attrs: { level },
                    content: [{ type: 'text', text: `H${level}` }]
                };
                const hashes = '#'.repeat(level);
                expect(convertNode(node, ctx)).to.equal(`${hashes} H${level}\n`);
            }
        });
    });

    describe('blockquote', () => {
        it('should prefix content with > ', () => {
            const node = {
                type: 'blockquote',
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'A quote' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('> ');
            expect(result).to.include('A quote');
        });
    });

    describe('hardBreak', () => {
        it('should output line break', () => {
            const node = { type: 'hardBreak' };
            expect(convertNode(node, ctx)).to.equal('  \n');
        });
    });

    describe('text', () => {
        it('should output plain text', () => {
            const node = { type: 'text', text: 'hello' };
            expect(convertNode(node, ctx)).to.equal('hello');
        });
    });

    describe('rule', () => {
        it('should output horizontal rule', () => {
            const node = { type: 'rule' };
            expect(convertNode(node, ctx)).to.equal('---\n');
        });
    });
});
