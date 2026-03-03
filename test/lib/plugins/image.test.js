import { expect } from 'chai';
import sinon from 'sinon';
import MarkdownIt from 'markdown-it';
import esmock from 'esmock';

describe('plugins/image', () => {
    let md, plugin, utilStub;
    const sandbox = sinon.createSandbox();

    beforeEach(async () => {
        // Mock util.safePath to control path resolution
        utilStub = {
            safePath: sandbox.stub()
        };
        plugin = (await esmock('../../../lib/plugins/image.js', {
            '../../../lib/util.js': { default: utilStub }
        })).default;
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should decode URL-encoded paths before calling safePath', () => {
        md = new MarkdownIt({ xhtmlOut: true, html: true }).use(plugin);
        utilStub.safePath.returns('docs/images/screenshot 2024.png');

        const page = {
            path: '/workspace/docs/section/index.md',
            attachments: []
        };
        const input = '![alt](../images/screenshot%202024.png)';
        const result = md.render(input, { page });

        // safePath should receive the decoded path
        expect(utilStub.safePath.calledOnce).to.be.true;
        expect(utilStub.safePath.firstCall.args[0]).to.equal('../images/screenshot 2024.png');
    });

    it('should produce ac:image markup for URL-encoded local images', () => {
        md = new MarkdownIt({ xhtmlOut: true, html: true }).use(plugin);
        utilStub.safePath.returns('docs/images/my image.png');

        const page = {
            path: '/workspace/docs/section/index.md',
            attachments: []
        };
        const input = '![test image](../images/my%20image.png)';
        const result = md.render(input, { page });

        expect(result).to.include('<ac:image');
        expect(result).to.include('ri:filename');
        expect(page.attachments.length).to.equal(1);
    });

    it('should fall through to default renderer when safePath returns undefined', () => {
        md = new MarkdownIt({ xhtmlOut: true, html: true }).use(plugin);
        utilStub.safePath.returns(undefined);

        const page = {
            path: '/workspace/docs/section/index.md',
            attachments: []
        };
        const input = '![broken](../images/missing%20file.png)';
        const result = md.render(input, { page });

        expect(result).to.include('<img');
        expect(page.attachments.length).to.equal(0);
    });

    it('should not URL-decode remote image URLs', () => {
        md = new MarkdownIt({ xhtmlOut: true, html: true }).use(plugin);

        const page = {
            path: '/workspace/docs/index.md',
            attachments: []
        };
        const input = '![remote](https://example.com/img%20test.png)';
        const result = md.render(input, { page });

        // Remote images should not call safePath
        expect(utilStub.safePath.called).to.be.false;
        expect(result).to.include('<img');
    });

    it('should handle paths without encoding (no spaces)', () => {
        md = new MarkdownIt({ xhtmlOut: true, html: true }).use(plugin);
        utilStub.safePath.returns('docs/images/simple.png');

        const page = {
            path: '/workspace/docs/index.md',
            attachments: []
        };
        const input = '![simple](images/simple.png)';
        const result = md.render(input, { page });

        expect(utilStub.safePath.calledOnce).to.be.true;
        expect(utilStub.safePath.firstCall.args[0]).to.equal('images/simple.png');
        expect(result).to.include('<ac:image');
    });
});
