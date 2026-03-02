import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/code-block', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/code-block.js');
    });

    const ctx = { depth: 0, listType: null, inlineMode: false };

    describe('codeBlock', () => {
        it('should convert code block with language attr', () => {
            const node = {
                type: 'codeBlock',
                attrs: { language: 'javascript' },
                content: [{ type: 'text', text: 'const x = 1;' }]
            };
            expect(convertNode(node, ctx)).to.equal('```javascript\nconst x = 1;\n```\n');
        });

        it('should convert code block without language attr', () => {
            const node = {
                type: 'codeBlock',
                attrs: {},
                content: [{ type: 'text', text: 'some code' }]
            };
            expect(convertNode(node, ctx)).to.equal('```\nsome code\n```\n');
        });

        it('should convert code block with no attrs', () => {
            const node = {
                type: 'codeBlock',
                content: [{ type: 'text', text: 'plain code' }]
            };
            expect(convertNode(node, ctx)).to.equal('```\nplain code\n```\n');
        });

        it('should handle empty code block', () => {
            const node = {
                type: 'codeBlock',
                attrs: { language: 'python' },
                content: []
            };
            expect(convertNode(node, ctx)).to.equal('```python\n\n```\n');
        });

        it('should handle multiline code content', () => {
            const node = {
                type: 'codeBlock',
                attrs: { language: 'yaml' },
                content: [{ type: 'text', text: 'key: value\nlist:\n  - item1\n  - item2' }]
            };
            expect(convertNode(node, ctx)).to.equal('```yaml\nkey: value\nlist:\n  - item1\n  - item2\n```\n');
        });
    });
});
