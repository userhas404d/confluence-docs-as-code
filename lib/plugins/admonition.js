/**
 * @module plugins/admonition
 */

/**
 * Maps MkDocs Material admonition types to Confluence panel macro names.
 * Confluence supports: note, tip, warning, info
 * @constant
 */
const TYPE_MAP = {
    note: 'note',
    tip: 'tip',
    hint: 'tip',
    important: 'tip',
    warning: 'warning',
    caution: 'warning',
    attention: 'warning',
    danger: 'warning',
    error: 'warning',
    info: 'info',
    abstract: 'info',
    summary: 'info',
    tldr: 'info',
    success: 'info',
    check: 'info',
    done: 'info',
    question: 'info',
    help: 'info',
    faq: 'info',
    example: 'info',
    quote: 'info',
    cite: 'info',
    bug: 'warning',
    failure: 'warning',
    fail: 'warning',
    missing: 'warning',
};

/**
 * Default titles for admonition types (capitalized type name)
 * @param {string} type - The admonition type
 * @returns {string} The default title
 */
function defaultTitle(type) {
    return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Map an MkDocs Material admonition type to a Confluence panel macro name
 * @param {string} type - The admonition type
 * @returns {string} The Confluence panel macro name
 */
function mapType(type) {
    return TYPE_MAP[type.toLowerCase()] || 'info';
}

/**
 * Parse an admonition opening line to extract type, title, and collapsible state.
 *
 * Supported syntaxes:
 *   !!! note                         -> regular, default title
 *   !!! note "Custom Title"          -> regular, custom title
 *   !!! note ""                      -> regular, no title
 *   ??? note                         -> collapsible (collapsed), default title
 *   ??? note "Custom Title"          -> collapsible (collapsed), custom title
 *   ???+ note                        -> collapsible (expanded), default title
 *   ???+ note "Custom Title"         -> collapsible (expanded), custom title
 *
 * @param {string} line - The opening line of the admonition
 * @returns {object|null} Parsed admonition info, or null if not a valid admonition
 */
function parseAdmonitionLine(line) {
    const match = line.match(/^(\?{3}\+?|!{3})\s+(\w+)(?:\s+"(.*)")?$/);
    if (!match) {
        return null;
    }

    const marker = match[1];
    const type = match[2];
    const customTitle = match[3];

    const collapsible = marker.startsWith('???');
    const expanded = marker === '???+';

    let title;
    if (customTitle !== undefined) {
        title = customTitle; // may be empty string for no-title
    } else {
        title = defaultTitle(type);
    }

    return { type, title, collapsible, expanded };
}

/**
 * MarkdownIt plugin to handle MkDocs Material admonitions.
 *
 * Converts admonition blocks to Confluence panel macros.
 * Collapsible admonitions (??? syntax) are wrapped in an expand macro.
 *
 * @param {MarkdownIt} md - A MarkdownIt instance
 */
function plugin(md) {
    md.block.ruler.before('fence', 'admonition', admonitionRule, {
        alt: ['paragraph', 'reference', 'blockquote', 'list']
    });

    md.renderer.rules.admonition_open = (tokens, idx) => {
        const token = tokens[idx];
        const panelType = mapType(token.info.type);
        const { title, collapsible } = token.info;

        let html = '';

        if (collapsible) {
            html += '<ac:structured-macro ac:name="expand">';
            if (title) {
                html += `<ac:parameter ac:name="title">${md.utils.escapeHtml(title)}</ac:parameter>`;
            }
            html += '<ac:rich-text-body>';
        }

        html += `<ac:structured-macro ac:name="${panelType}">`;
        if (title && !collapsible) {
            html += `<ac:parameter ac:name="title">${md.utils.escapeHtml(title)}</ac:parameter>`;
        }
        html += '<ac:rich-text-body>';

        return html;
    };

    md.renderer.rules.admonition_close = (tokens, idx) => {
        const token = tokens[idx];
        let html = '</ac:rich-text-body></ac:structured-macro>';

        if (token.info?.collapsible) {
            html += '</ac:rich-text-body></ac:structured-macro>';
        }

        return html;
    };
}

/**
 * markdown-it block rule for MkDocs Material admonitions.
 *
 * Parses blocks starting with !!!, ???, or ???+ followed by a type
 * and optional title in quotes. The body is indented by 4 spaces.
 *
 * @param {object} state - markdown-it block state
 * @param {number} startLine - Starting line number
 * @param {number} endLine - Ending line number
 * @param {boolean} silent - If true, only validate without modifying state
 * @returns {boolean} Whether an admonition was found
 */
function admonitionRule(state, startLine, endLine, silent) {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const lineText = state.src.slice(pos, max).trim();

    const parsed = parseAdmonitionLine(lineText);
    if (!parsed) {
        return false;
    }

    if (silent) {
        return true;
    }

    // Find the content lines (indented by 4 spaces)
    let nextLine = startLine + 1;
    let lastContentLine = startLine;

    while (nextLine < endLine) {
        const lineMax = state.eMarks[nextLine];
        const line = state.src.slice(state.bMarks[nextLine], lineMax);

        // Check if line is empty (blank lines within the admonition are ok)
        if (line.trim() === '') {
            // Look ahead: if next non-empty line is still indented, continue
            let lookAhead = nextLine + 1;
            let stillInBlock = false;
            while (lookAhead < endLine) {
                const laLine = state.src.slice(state.bMarks[lookAhead], state.eMarks[lookAhead]);
                if (laLine.trim() === '') {
                    lookAhead++;
                    continue;
                }
                if (laLine.match(/^(\s{4}|\t)/)) {
                    stillInBlock = true;
                }
                break;
            }
            if (stillInBlock) {
                nextLine++;
                continue;
            }
            break;
        }

        // Must be indented by at least 4 spaces or a tab
        if (!line.match(/^(\s{4}|\t)/)) {
            break;
        }

        lastContentLine = nextLine;
        nextLine++;
    }

    // Extract content (remove 4-space indent)
    const contentLines = [];
    for (let i = startLine + 1; i <= lastContentLine; i++) {
        const rawLine = state.src.slice(state.bMarks[i], state.eMarks[i]);
        // Remove exactly 4 spaces or 1 tab of indent
        const dedented = rawLine.replace(/^(\s{4}|\t)/, '');
        contentLines.push(dedented);
    }

    const content = contentLines.join('\n');

    // Create tokens
    const openToken = state.push('admonition_open', 'div', 1);
    openToken.info = parsed;
    openToken.block = true;
    openToken.map = [startLine, lastContentLine + 1];

    // Render the inner content as HTML and push as html_block
    const innerHtml = state.md.render(content, state.env);
    const htmlToken = state.push('html_block', '', 0);
    htmlToken.content = innerHtml;

    const closeToken = state.push('admonition_close', 'div', -1);
    closeToken.info = parsed;
    closeToken.block = true;

    state.line = lastContentLine + 1;

    return true;
}

export { parseAdmonitionLine, mapType };
export default plugin;
