/**
 * @module models/image
 */
import Attachment from './attachment.js';

/**
 * Represents an image found in a markdown file
 * 
 * @extends Attachment
 */
class Image extends Attachment {
    /**
     * @param {string} path - Image file path
     * @param {string} alt - Alt text
     * @param {object} [dimensions] - Optional dimensions
     * @param {string} [dimensions.width] - Image width
     * @param {string} [dimensions.height] - Image height
     */
    constructor(path, alt, dimensions = {}) {
        super(path);
        this.alt = alt;
        this.width = dimensions.width || '';
        this.height = dimensions.height || '';
    }

    /**
     * HTML markup for this image
     * 
     * @type {string} 
     */
    get markup() {
        let attrs = `ac:alt="${this.alt}"`;
        if (this.width) {
            attrs += ` ac:width="${this.width}"`;
        }
        if (this.height) {
            attrs += ` ac:height="${this.height}"`;
        }
        return `<ac:image ${attrs}><ri:attachment ri:filename="${this.filename}" /></ac:image>`;
    }
}

export default Image;
