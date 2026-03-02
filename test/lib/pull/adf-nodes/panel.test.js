import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/panel', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
        await import('../../../../lib/pull/adf-nodes/panel.js');
    });

    const ctx = { depth: 0, listType: null, inlineMode: false };

    describe('panelType to admonition mapping', () => {
        it('should map info panel to !!! info', () => {
            const node = {
                type: 'panel',
                attrs: { panelType: 'info' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Info message' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('!!! info');
            expect(result).to.include('    Info message');
        });

        it('should map note panel to !!! note', () => {
            const node = {
                type: 'panel',
                attrs: { panelType: 'note' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Note message' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('!!! note');
        });

        it('should map warning panel to !!! warning', () => {
            const node = {
                type: 'panel',
                attrs: { panelType: 'warning' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Warning message' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('!!! warning');
        });

        it('should map error panel to !!! danger', () => {
            const node = {
                type: 'panel',
                attrs: { panelType: 'error' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Error message' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('!!! danger');
        });

        it('should map success panel to !!! success', () => {
            const node = {
                type: 'panel',
                attrs: { panelType: 'success' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Success message' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('!!! success');
        });

        it('should map unknown panel type to !!! note', () => {
            const node = {
                type: 'panel',
                attrs: { panelType: 'custom' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Custom message' }]
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('!!! note');
        });
    });

    describe('panel content', () => {
        it('should indent content with 4 spaces', () => {
            const node = {
                type: 'panel',
                attrs: { panelType: 'info' },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Line 1' }]
                }]
            };
            const result = convertNode(node, ctx);
            const lines = result.split('\n');
            const contentLines = lines.filter(l => l.startsWith('    '));
            expect(contentLines).to.have.length.greaterThan(0);
            expect(contentLines[0]).to.equal('    Line 1');
        });

        it('should handle multi-paragraph panel content', () => {
            const node = {
                type: 'panel',
                attrs: { panelType: 'note' },
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'First paragraph' }]
                    },
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Second paragraph' }]
                    }
                ]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('    First paragraph');
            expect(result).to.include('    Second paragraph');
        });
    });
});
