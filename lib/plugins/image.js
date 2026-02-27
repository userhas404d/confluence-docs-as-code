/**
 * @module plugins/image
 */
import util from '../util.js';
import Image from '../models/image.js';

/**
 * Parse MkDocs Material attribute syntax from the token stream.
 *
 * Looks for a text token immediately after the image with content
 * like `{ width="300" }` or `{ width="300" height="200" }`.
 *
 * @param {Array} tokens - The full token stream
 * @param {number} idx - Index of the image token
 * @returns {object} Parsed dimensions: { width, height }
 */
function parseDimensions(tokens, idx) {
    const dimensions = {};

    // In inline tokens, check the next sibling token for attribute syntax
    // The image token is inside an inline token's children array
    const nextToken = tokens[idx + 1];
    if (nextToken && nextToken.type === 'text' && nextToken.content) {
        const match = nextToken.content.match(/^\{\s*(.*?)\s*\}/);
        if (match) {
            const attrStr = match[1];
            const widthMatch = attrStr.match(/width="?(\d+)"?/);
            const heightMatch = attrStr.match(/height="?(\d+)"?/);

            if (widthMatch) {
                dimensions.width = widthMatch[1];
            }
            if (heightMatch) {
                dimensions.height = heightMatch[1];
            }

            // Remove the consumed attribute text from the token
            nextToken.content = nextToken.content.slice(match[0].length);
        }
    }

    return dimensions;
}

/**
 * MarkdownIt plugin to handle images
 * 
 * @param {MarkdownIt} md - A `MarkdownIt` instance
 */
function plugin(md) {
    const _default = md.renderer.rules.image;
    md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const image = tokens[idx];
        const attrs = Object.fromEntries(image.attrs);
        const src = md.utils.escapeHtml(attrs.src);
        const { page } = env;
        const dimensions = parseDimensions(tokens, idx);

        if (isLocal(src)) {
            const relPath = util.safePath(src, page?.path);
            if (relPath) {
                const alt = md.utils.escapeHtml(image.content);
                const attachment = new Image(relPath, alt, dimensions);
                page?.attachments.push(attachment);
                return attachment.markup;
            }
        }

        return _default(tokens, idx, options, env, self);
    };
}
/**
 * 
 * @param {string} src - The `src` attribute of an image token
 * @returns {string} `true` if the `src` does not start with `http`
 */
function isLocal(src) {
    return !src.startsWith('http');
}

export { parseDimensions };
export default plugin;
