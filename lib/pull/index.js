#!/usr/bin/env node
/**
 * @module pull/index
 * @description CLI entry point for the Confluence → MkDocs Material pull tool.
 * Orchestrates tree walking, ADF conversion, file writing, and mkdocs.yml generation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parsePullConfig } from './pull-config.js';
import { walkTree } from './tree-walker.js';
import { convertAdf, createContext } from './adf-converter.js';
import { generateMkdocsYml } from './mkdocs-generator.js';
import { buildPageSlugMap, buildPageTitleMap } from './link-resolver.js';
import { downloadPageAttachments } from './attachment-downloader.js';
import PullSdk from './pull-sdk.js';
import logger from '../logger.js';

// Import all ADF node handlers to register them
import './adf-nodes/marks.js';
import './adf-nodes/paragraph.js';
import './adf-nodes/list.js';
import './adf-nodes/code-block.js';
import './adf-nodes/panel.js';
import './adf-nodes/expand.js';
import './adf-nodes/table.js';
import './adf-nodes/media.js';
import './adf-nodes/inline-card.js';
import './adf-nodes/layout.js';
import './adf-nodes/emoji.js';
import './adf-nodes/mention.js';

/**
 * Main pull orchestration.
 *
 * @param {string[]} argv - CLI arguments
 * @param {object} env - Environment variables
 */
export async function main(argv, env) {
    // Parse configuration
    const config = parsePullConfig(argv, env);
    logger.info(`Starting Confluence pull from page ${config.rootPageId}...`);

    // Initialize SDK
    const sdk = new PullSdk({
        host: config.confluenceUrl,
        user: config.confluenceUser,
        token: config.confluenceToken
    });

    // Walk page tree
    logger.info('Walking page tree...');
    const tree = await walkTree(sdk, config.rootPageId);
    const pageCount = countNodes(tree);
    logger.info(`  Found ${pageCount} pages across ${maxDepth(tree)} levels`);

    // Build page slug map and title map for link resolution
    const pageSlugMap = buildPageSlugMap(tree);
    const pageTitleMap = buildPageTitleMap(tree);

    // Ensure output directories exist
    const docsDir = path.join(config.outputDir, 'docs');
    const imagesDir = path.join(docsDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });

    // Process pages
    logger.info('Processing pages...');
    const stats = { pages: 0, attachments: 0, warnings: [] };
    await processNode(tree, sdk, config, docsDir, imagesDir, pageSlugMap, pageTitleMap, stats);

    // Generate mkdocs.yml
    logger.info('Generating mkdocs.yml...');
    const mkdocsContent = generateMkdocsYml(tree, tree.title || 'Documentation');
    fs.writeFileSync(path.join(config.outputDir, 'mkdocs.yml'), mkdocsContent, 'utf-8');

    // Summary
    logger.info('Pull complete!');
    logger.info(`  Pages: ${stats.pages}`);
    logger.info(`  Attachments: ${stats.attachments}`);
    logger.info(`  Warnings: ${stats.warnings.length}`);
    logger.info(`  Output: ${config.outputDir}/`);

    if (stats.warnings.length > 0) {
        logger.warn('Warnings:');
        for (const w of stats.warnings) {
            logger.warn(`  - ${w}`);
        }
    }
}

/**
 * Process a single page tree node — fetch body, download attachments, convert ADF, write file.
 *
 * @param {object} node - PageTreeNode
 * @param {object} sdk - ConfluenceSdk
 * @param {object} config - PullConfig
 * @param {string} docsDir - Output docs/ directory
 * @param {string} imagesDir - Output images/ directory
 * @param {Map} pageSlugMap - Page ID → relative path map
 * @param {Map} pageTitleMap - Page ID → title map
 * @param {object} stats - Statistics tracker
 */
async function processNode(node, sdk, config, docsDir, imagesDir, pageSlugMap, pageTitleMap, stats) {
    stats.pages++;
    const outputFile = path.join(docsDir, node.outputPath);

    logger.info(`  [${stats.pages}] ${node.title}${node.depth === 0 ? ' (root)' : ''}`);

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });

    // Download attachments for this page
    let attachmentMap = new Map();
    try {
        const result = await downloadPageAttachments(sdk, node.id, node.slug, imagesDir);
        ({ attachmentMap } = result);
        stats.attachments += result.downloadCount;
        if (result.downloadCount > 0) {
            logger.info(`    → ${node.outputPath} (${result.downloadCount} attachments)`);
        } else {
            logger.info(`    → ${node.outputPath}`);
        }
    } catch (err) {
        stats.warnings.push(`Failed to download attachments for "${node.title}": ${err.message}`);
        logger.info(`    → ${node.outputPath}`);
    }

    // Convert ADF → Markdown
    const context = createContext({
        pageId: node.id,
        pageTitle: node.title,
        currentOutputPath: node.outputPath,
        attachmentMap,
        pageSlugMap,
        pageTitleMap
    });

    let markdown;
    try {
        if (node.adfBody) {
            markdown = `# ${node.title}\n\n` + convertAdf(node.adfBody, context);
        } else {
            markdown = `# ${node.title}\n`;
        }
    } catch (err) {
        stats.warnings.push(`ADF conversion failed for "${node.title}": ${err.message}`);
        markdown = `# ${node.title}\n\n<!-- ADF conversion failed -->\n`;
    }

    // Write Markdown file
    fs.writeFileSync(outputFile, markdown, 'utf-8');

    // Process children
    for (const child of node.children) {
        await processNode(child, sdk, config, docsDir, imagesDir, pageSlugMap, pageTitleMap, stats);
    }
}

/**
 * Count total nodes in tree.
 *
 * @param {object} node - Root node
 * @returns {number} Total count
 */
function countNodes(node) {
    return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

/**
 * Get maximum depth of tree.
 *
 * @param {object} node - Root node
 * @returns {number} Max depth
 */
function maxDepth(node) {
    if (node.children.length === 0) return node.depth + 1;
    return Math.max(...node.children.map(child => maxDepth(child)));
}

// Run if executed directly
const isMainModule = process.argv[1] && (
    process.argv[1].endsWith('pull/index.js') ||
    process.argv[1].endsWith('pull/index')
);

if (isMainModule) {
    main(process.argv.slice(2), process.env).catch(err => {
        logger.error(`Fatal: ${err.message}`);
        process.exit(1);
    });
}
