import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/expand', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
        await import('../../../../lib/pull/adf-nodes/panel.js');
        await import('../../../../lib/pull/adf-nodes/expand.js');
    });

    const ctx = { depth: 0, listType: null, inlineMode: false };

    describe('expand', () => {
        it('should convert expand to ??? collapsible', () => {
            const node = {
                type: 'expand',
                attrs: { title: 'Click to expand' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Hidden content' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('???');
            expect(result).to.include('"Click to expand"');
        });

        it('should indent expand content with 4 spaces', () => {
            const node = {
                type: 'expand',
                attrs: { title: 'Details' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Detail content' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('    Detail content');
        });

        it('should use default title when no title attr', () => {
            const node = {
                type: 'expand',
                attrs: {},
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Content' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('???');
            expect(result).to.include('"Details"');
        });

        it('should handle expand wrapping a panel', () => {
            const node = {
                type: 'expand',
                attrs: { title: 'Warning Details' },
                content: [{
                    type: 'panel',
                    attrs: { panelType: 'warning' },
                    content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Warning content' }]
                    }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('???');
            expect(result).to.include('warning');
        });
    });
});
