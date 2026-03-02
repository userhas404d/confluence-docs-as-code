import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/mention', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/mention.js');
    });

    const ctx = { depth: 0 };

    it('should output @Display Name from attrs.text', () => {
        const node = {
            type: 'mention',
            attrs: { id: 'user-123', text: 'John Doe' }
        };
        expect(convertNode(node, ctx)).to.equal('@John Doe');
    });

    it('should handle missing text attr', () => {
        const node = {
            type: 'mention',
            attrs: { id: 'user-123' }
        };
        expect(convertNode(node, ctx)).to.equal('@unknown');
    });
});
