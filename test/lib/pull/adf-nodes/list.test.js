import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/list', () => {
    before(async () => {
        // Load marks handler (text nodes), paragraph handler, and list handler
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
        await import('../../../../lib/pull/adf-nodes/list.js');
    });

    // Note: No handlers.clear() — ESM module cache prevents re-registration

    const ctx = { depth: 0, listType: null, listItemIndex: 0, inlineMode: false };

    describe('bulletList', () => {
        it('should convert bullet list with items', () => {
            const node = {
                type: 'bulletList',
                content: [
                    {
                        type: 'listItem',
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'First' }]
                        }]
                    },
                    {
                        type: 'listItem',
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Second' }]
                        }]
                    }
                ]
            };

            const result = convertNode(node, { ...ctx });
            expect(result).to.include('- First');
            expect(result).to.include('- Second');
        });
    });

    describe('orderedList', () => {
        it('should convert ordered list with numbered items', () => {
            const node = {
                type: 'orderedList',
                content: [
                    {
                        type: 'listItem',
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Step 1' }]
                        }]
                    },
                    {
                        type: 'listItem',
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Step 2' }]
                        }]
                    }
                ]
            };

            const result = convertNode(node, { ...ctx });
            expect(result).to.include('1. Step 1');
            expect(result).to.include('1. Step 2');
        });
    });

    describe('nested lists', () => {
        it('should indent nested list items with 4 spaces', () => {
            const node = {
                type: 'bulletList',
                content: [
                    {
                        type: 'listItem',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'Parent' }]
                            },
                            {
                                type: 'bulletList',
                                content: [
                                    {
                                        type: 'listItem',
                                        content: [{
                                            type: 'paragraph',
                                            content: [{ type: 'text', text: 'Child' }]
                                        }]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            const result = convertNode(node, { ...ctx });
            expect(result).to.include('- Parent');
            expect(result).to.include('    - Child');
        });
    });
});
