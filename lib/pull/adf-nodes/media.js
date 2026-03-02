/**
 * @module pull/adf-nodes/media
 * @description ADF media handlers — converts media nodes to Markdown image embeds.
 */
import { registerHandler, convertChildren } from './index.js';

/**
 * Convert a media node to Markdown image.
 *
 * @param {object} node - ADF media node
 * @param {object} context - Conversion context with attachmentMap
 * @returns {string} Markdown image embed or placeholder comment
 */
function convertMediaNode(node, context) {
    const fileId = node.attrs?.id;
    const attachmentMap = context.attachmentMap || new Map();
    const localPath = attachmentMap.get(fileId);

    if (!localPath) {
        return `<!-- Missing attachment: ${fileId || 'unknown'} -->\n`;
    }

    // Make image path relative to the current page's directory
    let relativePath = localPath;
    const currentOutputPath = context.currentOutputPath;
    if (currentOutputPath && currentOutputPath.includes('/')) {
        const currentDir = currentOutputPath.substring(0, currentOutputPath.lastIndexOf('/'));
        // localPath is like "images/foo.png" — relative to docs root
        // We need "../images/foo.png" from a subdirectory
        const ups = currentDir.split('/').length;
        relativePath = '../'.repeat(ups) + localPath;
    }

    // Derive alt text from attrs.alt or filename
    const alt = node.attrs?.alt || localPath.split('/').pop().replace(/^[^-]+-/, '');

    return `![${alt}](${relativePath})\n`;
}

/**
 * Handler for mediaSingle — wraps a single media node.
 */
registerHandler('mediaSingle', (node, context) => {
    const content = node.content || [];
    if (content.length === 0) return '';

    const mediaNode = content.find(c => c.type === 'media');
    if (!mediaNode) return convertChildren(content, context);

    return convertMediaNode(mediaNode, context);
});

/**
 * Handler for media — standalone media node.
 */
registerHandler('media', (node, context) => {
    return convertMediaNode(node, context);
});

/**
 * Handler for mediaGroup — group of media nodes.
 */
registerHandler('mediaGroup', (node, context) => {
    const content = node.content || [];
    return content
        .filter(child => child.type === 'media')
        .map(child => convertMediaNode(child, context))
        .join('');
});
