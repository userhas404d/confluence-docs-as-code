import { expect } from 'chai';
import sinon from 'sinon';

describe('tree-walker', () => {
    let walkTree;

    beforeEach(async () => {
        const mod = await import('../../../lib/pull/tree-walker.js');
        walkTree = mod.walkTree;
    });

    it('should build a root PageTreeNode from a root page', async () => {
        const sdk = {
            getPageBody: sinon.stub().resolves({
                id: '100',
                title: 'Root Page',
                position: 0,
                version: { number: 3 },
                body: { atlas_doc_format: { value: '{"version":1,"type":"doc","content":[]}' } }
            }),
            getPageChildren: sinon.stub().resolves([])
        };

        const tree = await walkTree(sdk, '100');
        expect(tree.id).to.equal('100');
        expect(tree.title).to.equal('Root Page');
        expect(tree.version).to.equal(3);
        expect(tree.depth).to.equal(0);
        expect(tree.parentId).to.be.null;
        expect(tree.slug).to.equal('index');
        expect(tree.outputPath).to.equal('index.md');
        expect(tree.children).to.be.an('array').that.is.empty;
    });

    it('should recursively discover 3 levels of children', async () => {
        const sdk = {
            getPageBody: sinon.stub(),
            getPageChildren: sinon.stub()
        };

        // Root page
        sdk.getPageBody.withArgs('100').resolves({
            id: '100', title: 'Root', position: 0, version: { number: 1 },
            body: { atlas_doc_format: { value: '{}' } }
        });
        sdk.getPageChildren.withArgs('100').resolves([
            { id: '200', title: 'Architecture', type: 'page', childPosition: 0 }
        ]);

        // Level 1 child
        sdk.getPageBody.withArgs('200').resolves({
            id: '200', title: 'Architecture', position: 0, version: { number: 2 },
            body: { atlas_doc_format: { value: '{}' } }
        });
        sdk.getPageChildren.withArgs('200').resolves([
            { id: '300', title: 'System Design', type: 'page', childPosition: 0 }
        ]);

        // Level 2 child (leaf)
        sdk.getPageBody.withArgs('300').resolves({
            id: '300', title: 'System Design', position: 0, version: { number: 1 },
            body: { atlas_doc_format: { value: '{}' } }
        });
        sdk.getPageChildren.withArgs('300').resolves([]);

        const tree = await walkTree(sdk, '100');
        expect(tree.children).to.have.lengthOf(1);
        expect(tree.children[0].title).to.equal('Architecture');
        expect(tree.children[0].depth).to.equal(1);
        expect(tree.children[0].children).to.have.lengthOf(1);
        expect(tree.children[0].children[0].title).to.equal('System Design');
        expect(tree.children[0].children[0].depth).to.equal(2);
    });

    it('should compute correct outputPaths for section parents and leaves', async () => {
        const sdk = {
            getPageBody: sinon.stub(),
            getPageChildren: sinon.stub()
        };

        sdk.getPageBody.withArgs('100').resolves({
            id: '100', title: 'Root', position: 0, version: { number: 1 },
            body: { atlas_doc_format: { value: '{}' } }
        });
        sdk.getPageChildren.withArgs('100').resolves([
            { id: '200', title: 'Getting Started', type: 'page', childPosition: 0 },
            { id: '201', title: 'Architecture', type: 'page', childPosition: 1 }
        ]);

        // Getting Started = leaf (no children)
        sdk.getPageBody.withArgs('200').resolves({
            id: '200', title: 'Getting Started', position: 0, version: { number: 1 },
            body: { atlas_doc_format: { value: '{}' } }
        });
        sdk.getPageChildren.withArgs('200').resolves([]);

        // Architecture = section parent (has children)
        sdk.getPageBody.withArgs('201').resolves({
            id: '201', title: 'Architecture', position: 1, version: { number: 3 },
            body: { atlas_doc_format: { value: '{}' } }
        });
        sdk.getPageChildren.withArgs('201').resolves([
            { id: '300', title: 'System Design', type: 'page', childPosition: 0 }
        ]);
        sdk.getPageBody.withArgs('300').resolves({
            id: '300', title: 'System Design', position: 0, version: { number: 1 },
            body: { atlas_doc_format: { value: '{}' } }
        });
        sdk.getPageChildren.withArgs('300').resolves([]);

        const tree = await walkTree(sdk, '100');

        // Root → index.md
        expect(tree.outputPath).to.equal('index.md');
        // Leaf → getting-started.md
        expect(tree.children[0].outputPath).to.equal('getting-started.md');
        // Section parent → architecture/index.md
        expect(tree.children[1].outputPath).to.equal('architecture/index.md');
        // Leaf under section → architecture/system-design.md
        expect(tree.children[1].children[0].outputPath).to.equal('architecture/system-design.md');
    });

    it('should handle pages with empty children', async () => {
        const sdk = {
            getPageBody: sinon.stub().resolves({
                id: '100', title: 'Root', position: 0, version: { number: 1 },
                body: { atlas_doc_format: { value: '{}' } }
            }),
            getPageChildren: sinon.stub().resolves([])
        };

        const tree = await walkTree(sdk, '100');
        expect(tree.children).to.be.an('array').that.is.empty;
    });
});
