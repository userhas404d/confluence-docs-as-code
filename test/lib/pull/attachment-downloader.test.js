import { expect } from 'chai';
import sinon from 'sinon';

describe('attachment-downloader', () => {
    let downloadPageAttachments;

    beforeEach(async () => {
        const mod = await import('../../../lib/pull/attachment-downloader.js');
        downloadPageAttachments = mod.downloadPageAttachments;
    });

    it('should download image attachments and build attachmentMap', async () => {
        const sdk = {
            getAttachments: sinon.stub().resolves([
                {
                    id: 'att1',
                    title: 'screenshot.png',
                    mediaType: 'image/png',
                    fileSize: 1024,
                    fileId: 'file-id-1',
                    _links: { download: '/wiki/download/screenshot.png' }
                }
            ]),
            downloadAttachment: sinon.stub().resolves()
        };

        const result = await downloadPageAttachments(sdk, '100', 'my-page', '/tmp/images');
        expect(result.attachmentMap).to.be.a('map');
        expect(result.attachmentMap.get('file-id-1')).to.include('my-page-screenshot.png');
        expect(result.downloadCount).to.equal(1);
        expect(sdk.downloadAttachment.calledOnce).to.be.true;
    });

    it('should filter to image media types only', async () => {
        const sdk = {
            getAttachments: sinon.stub().resolves([
                {
                    id: 'att1', title: 'image.png', mediaType: 'image/png',
                    fileSize: 1024, fileId: 'f1', _links: { download: '/dl/1' }
                },
                {
                    id: 'att2', title: 'doc.pdf', mediaType: 'application/pdf',
                    fileSize: 2048, fileId: 'f2', _links: { download: '/dl/2' }
                },
                {
                    id: 'att3', title: 'photo.jpeg', mediaType: 'image/jpeg',
                    fileSize: 512, fileId: 'f3', _links: { download: '/dl/3' }
                }
            ]),
            downloadAttachment: sinon.stub().resolves()
        };

        const result = await downloadPageAttachments(sdk, '100', 'page', '/tmp/images');
        expect(result.downloadCount).to.equal(2);
        expect(sdk.downloadAttachment.callCount).to.equal(2);
        expect(result.attachmentMap.has('f1')).to.be.true;
        expect(result.attachmentMap.has('f2')).to.be.false;
        expect(result.attachmentMap.has('f3')).to.be.true;
    });

    it('should prefix filenames with page slug', async () => {
        const sdk = {
            getAttachments: sinon.stub().resolves([
                {
                    id: 'att1', title: 'image.png', mediaType: 'image/png',
                    fileSize: 100, fileId: 'f1', _links: { download: '/dl/1' }
                }
            ]),
            downloadAttachment: sinon.stub().resolves()
        };

        const result = await downloadPageAttachments(sdk, '100', 'getting-started', '/tmp/images');
        const localPath = result.attachmentMap.get('f1');
        expect(localPath).to.include('getting-started-image.png');
    });

    it('should handle download failure gracefully', async () => {
        const sdk = {
            getAttachments: sinon.stub().resolves([
                {
                    id: 'att1', title: 'broken.png', mediaType: 'image/png',
                    fileSize: 100, fileId: 'f1', _links: { download: '/dl/1' }
                }
            ]),
            downloadAttachment: sinon.stub().rejects(new Error('404 Not Found'))
        };

        const result = await downloadPageAttachments(sdk, '100', 'page', '/tmp/images');
        expect(result.downloadCount).to.equal(0);
        expect(result.warnings).to.have.length.greaterThan(0);
        expect(result.warnings[0]).to.include('broken.png');
    });

    it('should handle pages with no attachments', async () => {
        const sdk = {
            getAttachments: sinon.stub().resolves([])
        };

        const result = await downloadPageAttachments(sdk, '100', 'page', '/tmp/images');
        expect(result.attachmentMap.size).to.equal(0);
        expect(result.downloadCount).to.equal(0);
    });
});
