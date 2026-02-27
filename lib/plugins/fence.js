/**
 * @module plugins/fence
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import Graph from '../models/graph.js';

/**
 * Parse a fenced code block info string into its components.
 *
 * Supports MkDocs Material syntax:
 *   ```python title="main.py" linenums="1"
 *
 * @param {string} info - The raw info string from the fenced code block
 * @returns {object} Parsed components: { language, title, linenums }
 */
function parseInfoString(info) {
    const trimmed = (info || '').trim();
    if (trimmed.length === 0) {
        return { language: '', title: '', linenums: '' };
    }

    // Extract key="value" pairs
    const titleMatch = trimmed.match(/\btitle="([^"]*)"/);
    const linenumsMatch = trimmed.match(/\blinenums="([^"]*)"/);

    // Language is the first word (before any key=value pairs)
    const language = trimmed.split(/\s+/)[0].replace(/\btitle=.*/, '').replace(/\blinenums=.*/, '').trim();

    return {
        language: language || '',
        title: titleMatch ? titleMatch[1] : '',
        linenums: linenumsMatch ? linenumsMatch[1] : '',
    };
}

/**
 * MarkdownIt plugin to handle fenced code blocks
 * 
 * @param {MarkdownIt} md - A `MarkdownIt` instance
 * @param {object} options - Plugin options
 */
function plugin(md, options) {
    const config = options.graphs;
    const supportedGraphs = Object.keys(config);

    md.renderer.rules.fence = (tokens, idx, _, env) => {
        const token = tokens[idx];
        const info = parseInfoString(token?.info);
        const content = token?.content?.trim();
        if (supportedGraphs.includes(info.language)) {
            return processGraph(config[info.language], content, env);
        }
        return codeMacro(info, content);
    };
}
/**
 * 
 * @param {object} info - Parsed info string: { language, title, linenums }
 * @param {string} content - Fenced code content
 * @returns {string} Html markup
 */
function codeMacro(info, content) {
    if (content.length === 0) {
        return '';
    }

    const { language, title, linenums } = info;
    const cdata = `<![CDATA[${escape(content)}]]>`;
    let parameters = '';
    if (language.length > 0) {
        parameters += `<ac:parameter ac:name="language">${language}</ac:parameter>`;
    }
    if (title.length > 0) {
        parameters += `<ac:parameter ac:name="title">${title}</ac:parameter>`;
    }
    if (linenums.length > 0) {
        parameters += '<ac:parameter ac:name="linenumbers">true</ac:parameter>';
        const firstLine = parseInt(linenums, 10);
        if (!isNaN(firstLine) && firstLine > 1) {
            parameters += `<ac:parameter ac:name="firstline">${firstLine}</ac:parameter>`;
        }
    }
    return `<ac:structured-macro ac:name="code">${parameters}<ac:plain-text-body>${cdata}</ac:plain-text-body></ac:structured-macro>\n`;
}

/**
 * Escape the string `]]>` found in `str` in order to be valid inside a `CDATA` block
 *  
 * @param {string} str - Text to escape
 * @returns {string} Escaped text
 */
function escape(str) {
    return str.replace(/]]>/g, ']]]]><![CDATA[>');
}

/**
 * Processes graph content and produces appropriate markup based on the configuration
 * 
 * @param {string} config - Configuration specific to the fenced code language attribute
 * @param {string} content - Fenced code content 
 * @param {object} param2 - Parser environment object
 * @returns {string} Html markup
 */
function processGraph(config, content, { page }) {
    if (config.renderer === 'none') {
        return codeMacro({ language: config.type, title: '', linenums: '' }, content);
    }
    const source = page?.meta?.path;
    const alt = `graph_${page.attachments.length + 1}`;
    const graph = path.basename(source, '.md') + '_' + alt + config.extension;
    const resolvedPath = path.resolve(path.dirname(source), graph);
    writeFileSync(resolvedPath, content, 'utf8');
    const relPath = path.relative(process.cwd(), resolvedPath);
    const attachment = new Graph(relPath, config.type, config.renderer, alt);
    page.attachments.push(attachment);
    return attachment.markup;
}

export { parseInfoString };
export default plugin;
