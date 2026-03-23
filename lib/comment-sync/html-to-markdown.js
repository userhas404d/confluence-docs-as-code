/**
 * Converts Confluence storage-format HTML to Markdown using turndown.
 *
 * @module comment-sync/html-to-markdown
 */
import TurndownService from 'turndown';

const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
});

// Confluence uses <ac:structured-macro> for code blocks — pass through as fenced
td.addRule('confluenceCodeBlock', {
    filter(node) {
        return (
            node.nodeName === 'AC:STRUCTURED-MACRO' &&
            node.getAttribute('ac:name') === 'code'
        );
    },
    replacement(_content, node) {
        const bodyNode = node.querySelector('ac\\:plain-text-body') || node;
        const code = bodyNode.textContent || '';
        const lang = node.querySelector('ac\\:parameter[ac\\:name="language"]')?.textContent || '';
        return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }
});

/**
 * Convert Confluence storage-format HTML to Markdown.
 *
 * @param {string} html - Confluence storage format HTML
 * @returns {string} Markdown text
 */
export function htmlToMarkdown(html) {
    if (!html) return '';
    return td.turndown(html);
}

/**
 * Convert Markdown to a basic Confluence storage format.
 * This is intentionally simple — Confluence comments don't need
 * the full markdown-it rendering pipeline. We wrap markdown in
 * a simple paragraph with line breaks preserved.
 *
 * For richer conversion, the main publisher's PageRenderer could be reused.
 *
 * @param {string} markdown - Markdown text 
 * @returns {string} Confluence storage-format HTML
 */
export function markdownToHtml(markdown) {
    if (!markdown) return '';
    // Minimal conversion: escape HTML entities, convert line breaks, 
    // wrap in <p> tags, handle bold/italic/code
    let html = markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Line breaks within paragraphs
    html = html.replace(/\n/g, '<br />');

    return `<p>${html}</p>`;
}
