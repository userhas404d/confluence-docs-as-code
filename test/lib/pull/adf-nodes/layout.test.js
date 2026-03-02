import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/layout', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
        await import('../../../../lib/pull/adf-nodes/layout.js');
    });

    const ctx = { depth: 0, listType: null, inlineMode: false };

    describe('layoutSection', () => {
        it('should flatten layout columns into sequential blocks', () => {
            const node = {
                type: 'layoutSection',
                content: [
                    {
                        type: 'layoutColumn',
                        attrs: { width: 50 },
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Column 1 content' }]
                        }]
                    },
                    {
                        type: 'layoutColumn',
                        attrs: { width: 50 },
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Column 2 content' }]
                        }]
                    }
                ]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('Column 1 content');
            expect(result).to.include('Column 2 content');
            expect(result).to.include('<!-- Original layout had 2 columns -->');
        });
    });

    describe('layoutColumn', () => {
        it('should convert column content to sequential blocks', () => {
            const node = {
                type: 'layoutColumn',
                attrs: { width: 100 },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Column content' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('Column content');
        });
    });
});
