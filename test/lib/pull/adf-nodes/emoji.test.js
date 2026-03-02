import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/emoji', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/emoji.js');
    });

    const ctx = { depth: 0 };

    it('should output Unicode character from attrs.text', () => {
        const node = {
            type: 'emoji',
            attrs: { shortName: ':thumbsup:', text: '👍' }
        };
        expect(convertNode(node, ctx)).to.equal('👍');
    });

    it('should fallback to :shortName: when text not available', () => {
        const node = {
            type: 'emoji',
            attrs: { shortName: ':custom_emoji:' }
        };
        expect(convertNode(node, ctx)).to.equal(':custom_emoji:');
    });

    it('should handle missing attrs', () => {
        const node = { type: 'emoji' };
        expect(convertNode(node, ctx)).to.equal('');
    });
});
