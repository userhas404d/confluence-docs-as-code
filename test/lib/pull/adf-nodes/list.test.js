import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/list', () => {
    before(async () => {
        // Load marks handler (text nodes), paragraph handler, code-block, media, and list handler
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
        await import('../../../../lib/pull/adf-nodes/code-block.js');
        await import('../../../../lib/pull/adf-nodes/media.js');
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

    describe('multi-content list items', () => {
        it('should render codeBlock as indented continuation within a list item', () => {
            const node = {
                type: 'orderedList',
                content: [
                    {
                        type: 'listItem',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'Create an authenticated proxy' }]
                            },
                            {
                                type: 'codeBlock',
                                content: [{ type: 'text', text: 'tsh proxy db --tunnel <name>' }]
                            }
                        ]
                    },
                    {
                        type: 'listItem',
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Update your code' }]
                        }]
                    }
                ]
            };

            const result = convertNode(node, { ...ctx });
            const lines = result.split('\n');

            // First item gets the marker
            expect(lines[0]).to.equal('1. Create an authenticated proxy');

            // Code block should be indented, not a new list item
            expect(result).to.not.match(/1\. tsh proxy/);
            expect(result).to.include('    ```');
            expect(result).to.include('    tsh proxy db --tunnel <name>');

            // Second item gets its own marker
            expect(result).to.include('1. Update your code');
        });

        it('should render mediaSingle as indented continuation within a list item', () => {
            const node = {
                type: 'orderedList',
                content: [
                    {
                        type: 'listItem',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'Check the screenshot below' }]
                            },
                            {
                                type: 'mediaSingle',
                                content: [{
                                    type: 'media',
                                    attrs: { type: 'file', id: 'img-1', collection: '' }
                                }]
                            }
                        ]
                    }
                ]
            };

            const ctx2 = {
                ...ctx,
                attachmentMap: new Map([['img-1', 'images/screenshot.png']])
            };
            const result = convertNode(node, ctx2);

            // Image should be indented, not a new list item
            expect(result).to.include('1. Check the screenshot below');
            expect(result).to.match(/\s{4}!\[/);
            expect(result).to.not.match(/1\. !\[/);
        });

        it('should handle empty paragraph as continuation blank line', () => {
            const node = {
                type: 'orderedList',
                content: [
                    {
                        type: 'listItem',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'First line' }]
                            },
                            {
                                type: 'paragraph'
                                // no content = empty paragraph
                            },
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'After gap' }]
                            }
                        ]
                    }
                ]
            };

            const result = convertNode(node, { ...ctx });
            expect(result).to.include('1. First line');
            // Empty paragraph should not create a new numbered item
            expect(result).to.not.match(/1\. \n/);
            expect(result).to.include('    After gap');
        });
    });
});
