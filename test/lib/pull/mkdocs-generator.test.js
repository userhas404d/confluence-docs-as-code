import { expect } from 'chai';

describe('mkdocs-generator', () => {
    let generateMkdocsYml;

    beforeEach(async () => {
        const mod = await import('../../../lib/pull/mkdocs-generator.js');
        generateMkdocsYml = mod.generateMkdocsYml;
    });

    it('should generate valid YAML with Material theme', () => {
        const tree = {
            title: 'Root',
            slug: 'index',
            outputPath: 'index.md',
            children: []
        };
        const yml = generateMkdocsYml(tree);
        expect(yml).to.include('name: material');
        expect(yml).to.include('admonition');
        expect(yml).to.include('pymdownx.details');
        expect(yml).to.include('pymdownx.superfences');
    });

    it('should generate nav section with Home as root', () => {
        const tree = {
            title: 'Root',
            slug: 'index',
            outputPath: 'index.md',
            children: []
        };
        const yml = generateMkdocsYml(tree);
        expect(yml).to.include('Home: index.md');
    });

    it('should produce 3-level nav hierarchy', () => {
        const tree = {
            title: 'Root',
            slug: 'index',
            outputPath: 'index.md',
            children: [
                {
                    title: 'Getting Started',
                    slug: 'getting-started',
                    outputPath: 'getting-started.md',
                    children: []
                },
                {
                    title: 'Architecture',
                    slug: 'architecture',
                    outputPath: 'architecture/index.md',
                    children: [
                        {
                            title: 'System Design',
                            slug: 'system-design',
                            outputPath: 'architecture/system-design.md',
                            children: []
                        },
                        {
                            title: 'Data Flow',
                            slug: 'data-flow',
                            outputPath: 'architecture/data-flow.md',
                            children: []
                        }
                    ]
                }
            ]
        };

        const yml = generateMkdocsYml(tree);
        expect(yml).to.include('Home: index.md');
        expect(yml).to.include('Getting Started: getting-started.md');
        expect(yml).to.include('Architecture');
        expect(yml).to.include('Architecture: architecture/index.md');
        expect(yml).to.include('System Design: architecture/system-design.md');
        expect(yml).to.include('Data Flow: architecture/data-flow.md');
    });

    it('should include content.code.copy feature', () => {
        const tree = { title: 'Root', slug: 'index', outputPath: 'index.md', children: [] };
        const yml = generateMkdocsYml(tree);
        expect(yml).to.include('content.code.copy');
    });
});
