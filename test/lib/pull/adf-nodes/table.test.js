import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/table', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
        await import('../../../../lib/pull/adf-nodes/table.js');
    });

    const ctx = { depth: 0, listType: null, inlineMode: false };

    describe('table', () => {
        it('should convert table with headers and data rows', () => {
            const node = {
                type: 'table',
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableHeader',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }]
                            },
                            {
                                type: 'tableHeader',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }]
                            }
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableCell',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'key1' }] }]
                            },
                            {
                                type: 'tableCell',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'val1' }] }]
                            }
                        ]
                    }
                ]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('| Name | Value |');
            expect(result).to.include('| --- | --- |');
            expect(result).to.include('| key1 | val1 |');
        });

        it('should handle empty cells', () => {
            const node = {
                type: 'table',
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableHeader',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }]
                            },
                            {
                                type: 'tableHeader',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }]
                            }
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableCell',
                                content: [{ type: 'paragraph', content: [] }]
                            },
                            {
                                type: 'tableCell',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'data' }] }]
                            }
                        ]
                    }
                ]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('|  | data |');
        });

        it('should handle cells with inline marks', () => {
            const node = {
                type: 'table',
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableHeader',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header' }] }]
                            }
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableCell',
                                content: [{
                                    type: 'paragraph',
                                    content: [{
                                        type: 'text',
                                        text: 'bold',
                                        marks: [{ type: 'strong' }]
                                    }]
                                }]
                            }
                        ]
                    }
                ]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('**bold**');
        });

        it('should handle table without header row', () => {
            const node = {
                type: 'table',
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableCell',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }]
                            },
                            {
                                type: 'tableCell',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }]
                            }
                        ]
                    }
                ]
            };
            const result = convertNode(node, ctx);
            // Should still produce a valid table with empty header
            expect(result).to.include('|');
            expect(result).to.include('---');
        });
    });
});
