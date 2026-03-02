/**
 * @module pull/tree-walker
 * @description Recursively walks the Confluence page tree using DFS,
 * building a PageTreeNode structure with slugs and output paths.
 */
import { slugify, resolveSlug } from './slug.js';

/**
 * @typedef {Object} PageTreeNode
 * @property {string} id - Confluence page ID
 * @property {string} title - Page title
 * @property {number} position - Child position (for nav ordering)
 * @property {number} depth - Tree depth (0 = root)
 * @property {string|null} parentId - Parent page ID
 * @property {PageTreeNode[]} children - Ordered child nodes
 * @property {string} slug - Generated filename slug
 * @property {string} outputPath - Relative path from docs/
 * @property {object} adfBody - Raw ADF body object
 */

/**
 * Walk the Confluence page tree starting from rootPageId.
 *
 * @param {object} sdk - ConfluenceSdk instance with getPageBody() and getPageChildren()
 * @param {string} rootPageId - Page ID to start from
 * @returns {Promise<PageTreeNode>} Root of the page tree
 */
export async function walkTree(sdk, rootPageId) {
    const usedSlugs = new Set();
    return walkNode(sdk, rootPageId, 0, null, '', usedSlugs);
}

/**
 * Recursively build a PageTreeNode.
 *
 * @param {object} sdk - ConfluenceSdk instance
 * @param {string} pageId - Current page ID
 * @param {number} depth - Current depth
 * @param {string|null} parentId - Parent page ID
 * @param {string} parentPath - Parent directory path prefix
 * @param {Set<string>} usedSlugs - Set of used slugs for collision resolution
 * @returns {Promise<PageTreeNode>}
 */
async function walkNode(sdk, pageId, depth, parentId, parentPath, usedSlugs) {
    const pageData = await sdk.getPageBody(pageId);
    const childrenData = await sdk.getPageChildren(pageId);

    // Parse ADF body
    let adfBody = null;
    try {
        const adfValue = pageData.body?.atlas_doc_format?.value;
        if (adfValue) {
            adfBody = typeof adfValue === 'string' ? JSON.parse(adfValue) : adfValue;
        }
    } catch {
        // ADF parse failure handled downstream
    }

    // Recursively walk children first to determine if this is a section parent
    const children = [];
    for (const child of childrenData) {
        try {
            const childNode = await walkNode(
                sdk,
                child.id,
                depth + 1,
                pageId,
                '', // Will be computed after we know if parent has children
                usedSlugs
            );
            children.push(childNode);
        } catch (err) {
            // Skip pages that can't be fetched (e.g. drafts, restricted)
             
            console.warn(`Skipping page ${child.id} (${child.title || 'untitled'}): ${err.message}`);
        }
    }

    // Compute slug and outputPath
    let slug, outputPath;
    if (depth === 0) {
        // Root page → index.md
        slug = 'index';
        outputPath = 'index.md';
    } else {
        slug = resolveSlug(slugify(pageData.title), usedSlugs);

        if (children.length > 0) {
            // Section parent → subdirectory/index.md
            outputPath = `${slug}/index.md`;
        } else {
            // Leaf page → filename.md (in parent's directory)
            outputPath = `${slug}.md`;
        }
    }

    // Fix children outputPaths to include parent directory
    if (children.length > 0 && depth > 0) {
        fixChildPaths(children, slug);
    } else if (depth === 0 && children.length > 0) {
        // Root's children: check if they need subdirectories
        // Children at depth 1 don't need a parent prefix
    }

    return {
        id: pageData.id,
        title: pageData.title,
        position: pageData.position || 0,
        depth,
        parentId,
        children,
        slug,
        outputPath,
        adfBody
    };
}

/**
 * Prefix children's output paths with the parent's slug directory.
 *
 * @param {PageTreeNode[]} children - Child nodes
 * @param {string} parentSlug - Parent's slug (directory name)
 */
function fixChildPaths(children, parentSlug) {
    for (const child of children) {
        child.outputPath = `${parentSlug}/${child.outputPath}`;
        if (child.children.length > 0) {
            // Already handled by recursive walk — paths are relative
        }
    }
}
