/**
 * @module pull/mkdocs-generator
 * @description Generates mkdocs.yml configuration from a PageTreeNode tree.
 */
import YAML from 'yaml';

/**
 * Generate mkdocs.yml content from a page tree.
 *
 * @param {import('./tree-walker.js').PageTreeNode} tree - Root of the page tree
 * @param {string} [siteName='Documentation'] - Site name for mkdocs.yml
 * @returns {string} YAML string for mkdocs.yml
 */
export function generateMkdocsYml(tree, siteName = 'Documentation') {
    const nav = buildNav(tree);

    const config = {
        site_name: siteName,
        theme: {
            name: 'material',
            features: [
                'navigation.sections',
                'navigation.expand',
                'content.code.copy'
            ]
        },
        markdown_extensions: [
            'admonition',
            'pymdownx.details',
            'pymdownx.superfences',
            { 'pymdownx.tabbed': { alternate_style: true } },
            'tables'
        ],
        nav
    };

    return YAML.stringify(config, { lineWidth: 120 });
}

/**
 * Build the nav array from a PageTreeNode tree.
 *
 * @param {import('./tree-walker.js').PageTreeNode} tree - Root node
 * @returns {Array} MkDocs nav structure
 */
function buildNav(tree) {
    const nav = [];

    // Root → Home: index.md
    nav.push({ Home: 'index.md' });

    // Add children
    for (const child of tree.children) {
        nav.push(buildNavEntry(child));
    }

    return nav;
}

/**
 * Build a single nav entry from a PageTreeNode.
 *
 * @param {import('./tree-walker.js').PageTreeNode} node - Page node
 * @returns {object|object} Nav entry (leaf: {Title: path}, section: {Title: [children]})
 */
function buildNavEntry(node) {
    if (node.children.length === 0) {
        // Leaf page → direct file reference
        return { [node.title]: node.outputPath };
    }

    // Section parent → nested nav
    // Use the original page title (not generic "Overview") to ensure
    // unique titles when round-tripping back to Confluence.
    const entries = [];
    entries.push({ [node.title]: node.outputPath });

    for (const child of node.children) {
        entries.push(buildNavEntry(child));
    }

    return { [node.title]: entries };
}
