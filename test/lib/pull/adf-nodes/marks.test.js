import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/marks', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
    });

    // Note: No handlers.clear() — ESM module cache prevents re-registration

    const ctx = { depth: 0, listType: null, inlineMode: false };

    describe('strong mark', () => {
        it('should wrap text in double asterisks', () => {
            const node = {
                type: 'text',
                text: 'bold text',
                marks: [{ type: 'strong' }]
            };
            expect(convertNode(node, ctx)).to.equal('**bold text**');
        });
    });

    describe('em mark', () => {
        it('should wrap text in single asterisks', () => {
            const node = {
                type: 'text',
                text: 'italic text',
                marks: [{ type: 'em' }]
            };
            expect(convertNode(node, ctx)).to.equal('*italic text*');
        });
    });

    describe('code mark', () => {
        it('should wrap text in backticks', () => {
            const node = {
                type: 'text',
                text: 'code',
                marks: [{ type: 'code' }]
            };
            expect(convertNode(node, ctx)).to.equal('`code`');
        });
    });

    describe('link mark', () => {
        it('should create markdown link', () => {
            const node = {
                type: 'text',
                text: 'click here',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }]
            };
            expect(convertNode(node, ctx)).to.equal('[click here](https://example.com)');
        });
    });

    describe('strike mark', () => {
        it('should wrap text in double tildes', () => {
            const node = {
                type: 'text',
                text: 'removed',
                marks: [{ type: 'strike' }]
            };
            expect(convertNode(node, ctx)).to.equal('~~removed~~');
        });
    });

    describe('multiple marks', () => {
        it('should apply all marks to text', () => {
            const node = {
                type: 'text',
                text: 'bolditalic',
                marks: [{ type: 'strong' }, { type: 'em' }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('**');
            expect(result).to.include('*');
            expect(result).to.include('bolditalic');
        });
    });
});
