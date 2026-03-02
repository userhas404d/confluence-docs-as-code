import { expect } from 'chai';
import { registerHandler, handlers, convertNode } from '../../../../lib/pull/adf-nodes/index.js';

describe('adf-nodes/media', () => {
    before(async () => {
        await import('../../../../lib/pull/adf-nodes/marks.js');
        await import('../../../../lib/pull/adf-nodes/paragraph.js');
        await import('../../../../lib/pull/adf-nodes/media.js');
    });

    describe('mediaSingle', () => {
        it('should convert mediaSingle with resolved attachment to image embed', () => {
            const ctx = {
                depth: 0,
                attachmentMap: new Map([['file-123', 'images/page-screenshot.png']])
            };
            const node = {
                type: 'mediaSingle',
                content: [{
                    type: 'media',
                    attrs: {
                        type: 'file',
                        id: 'file-123',
                        collection: '',
                        alt: 'Screenshot'
                    }
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('![Screenshot](images/page-screenshot.png)');
        });

        it('should use filename as alt text when no alt attr', () => {
            const ctx = {
                depth: 0,
                attachmentMap: new Map([['file-456', 'images/page-diagram.png']])
            };
            const node = {
                type: 'mediaSingle',
                content: [{
                    type: 'media',
                    attrs: {
                        type: 'file',
                        id: 'file-456',
                        collection: ''
                    }
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('![diagram.png](images/page-diagram.png)');
        });

        it('should output placeholder for missing attachment', () => {
            const ctx = {
                depth: 0,
                attachmentMap: new Map()
            };
            const node = {
                type: 'mediaSingle',
                content: [{
                    type: 'media',
                    attrs: {
                        type: 'file',
                        id: 'missing-file',
                        collection: ''
                    }
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('<!-- Missing attachment:');
        });
    });

    describe('mediaGroup', () => {
        it('should render multiple media nodes', () => {
            const ctx = {
                depth: 0,
                attachmentMap: new Map([
                    ['f1', 'images/img1.png'],
                    ['f2', 'images/img2.png']
                ])
            };
            const node = {
                type: 'mediaGroup',
                content: [
                    { type: 'media', attrs: { type: 'file', id: 'f1', collection: '' } },
                    { type: 'media', attrs: { type: 'file', id: 'f2', collection: '' } }
                ]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('![img1.png](images/img1.png)');
            expect(result).to.include('![img2.png](images/img2.png)');
        });
    });

    describe('subdirectory path relativization', () => {
        it('should add ../ to image paths when page is in a subdirectory', () => {
            const ctx = {
                depth: 0,
                currentOutputPath: 'teleport-and-aws/index.md',
                attachmentMap: new Map([['file-789', 'images/teleport-and-aws-screenshot.png']])
            };
            const node = {
                type: 'mediaSingle',
                content: [{
                    type: 'media',
                    attrs: {
                        type: 'file',
                        id: 'file-789',
                        collection: ''
                    }
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('(../images/teleport-and-aws-screenshot.png)');
        });

        it('should not add ../ when page is at docs root', () => {
            const ctx = {
                depth: 0,
                currentOutputPath: 'index.md',
                attachmentMap: new Map([['file-000', 'images/root-image.png']])
            };
            const node = {
                type: 'mediaSingle',
                content: [{
                    type: 'media',
                    attrs: {
                        type: 'file',
                        id: 'file-000',
                        collection: ''
                    }
                }]
            };
            const result = convertNode(node, ctx);
            expect(result).to.include('(images/root-image.png)');
            expect(result).to.not.include('../');
        });
    });
});
