/**
 * @module plugins/admonition
 * @description MarkdownIt plugin to convert MkDocs Material admonition syntax
 * (`!!! type` and `??? type "title"`) to Confluence structured macros.
 *
 * MkDocs type → Confluence macro mapping:
 * - info → info
 * - note → note
 * - warning → warning
 * - danger → warning
 * - tip → tip
 * - success → tip
 * - example → info
 * - quote → note
 *
 * `!!!` produces a visible box; `???` produces an expand macro wrapping the box.
 */

/**
 * Map MkDocs admonition types to Confluence macro names.
 * @type {Object<string, string>}
 */
const TYPE_MAP = {
    info: 'info',
    note: 'note',
    warning: 'warning',
    danger: 'warning',
    error: 'warning',
    tip: 'tip',
    hint: 'tip',
    success: 'tip',
    check: 'tip',
    example: 'info',
    quote: 'note',
    cite: 'note',
    abstract: 'info',
    summary: 'info',
    bug: 'warning',
    failure: 'warning',
    fail: 'warning',
    question: 'info',
    help: 'info',
    faq: 'info'
};

/**
 * MarkdownIt plugin to handle MkDocs Material admonition blocks.
 *
 * Parses:
 *   !!! type            → <ac:structured-macro ac:name="...">
 *   !!! type "title"    → same, with title parameter
 *   ??? type "title"    → expand macro wrapping the admonition content
 *       indented body
 *
 * @param {MarkdownIt} md - A MarkdownIt instance
 */
function plugin(md) {
    md.block.ruler.before('fence', 'admonition', admonitionRule, {
        alt: ['paragraph', 'reference', 'blockquote']
    });
    md.renderer.rules.admonition_open = renderOpen;
    md.renderer.rules.admonition_close = renderClose;
}

/**
 * Block rule that detects admonition markers.
 */
function admonitionRule(state, startLine, endLine, silent) {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const lineText = state.src.slice(pos, max);

    // Match !!! type or ??? type, optionally with "title"
    const match = lineText.match(/^([!?]{3})\s+(\w+)(?:\s+"([^"]*)")?/);
    if (!match) return false;
    if (silent) return true;

    const marker = match[1];       // '!!!' or '???'
    const admonType = match[2];    // 'warning', 'note', etc.
    const title = match[3] || '';  // optional quoted title
    const collapsible = marker === '???';

    // Determine how many indented body lines follow (4-space or 1-tab indent)
    const contentIndent = state.tShift[startLine] + 4;
    let nextLine = startLine + 1;

    while (nextLine < endLine) {
        if (state.sCount[nextLine] < contentIndent) {
            // Check for blank lines — they're allowed inside admonitions
            const blankPos = state.bMarks[nextLine] + state.tShift[nextLine];
            const blankMax = state.eMarks[nextLine];
            if (blankPos >= blankMax) {
                // Blank line — continue only if next non-blank line is indented
                let peek = nextLine + 1;
                while (peek < endLine) {
                    const peekPos = state.bMarks[peek] + state.tShift[peek];
                    const peekMax = state.eMarks[peek];
                    if (peekPos < peekMax) break; // non-blank
                    peek++;
                }
                if (peek < endLine && state.sCount[peek] >= contentIndent) {
                    nextLine++;
                    continue;
                }
            }
            break;
        }
        nextLine++;
    }

    // Create tokens
    const openToken = state.push('admonition_open', 'div', 1);
    openToken.meta = { type: admonType, title, collapsible };
    openToken.map = [startLine, nextLine];
    openToken.block = true;

    // Parse the indented content as markdown
    const oldParent = state.parentType;
    const oldLineMax = state.lineMax;
    state.parentType = 'admonition';
    state.lineMax = nextLine;

    // Manually adjust indentation for inner content
    const oldBMarks = [];
    const oldTShift = [];
    const oldSCount = [];
    for (let i = startLine + 1; i < nextLine; i++) {
        oldBMarks.push(state.bMarks[i]);
        oldTShift.push(state.tShift[i]);
        oldSCount.push(state.sCount[i]);
        // Remove the 4-space indent for inner parsing
        const lineStart = state.bMarks[i] + state.tShift[i];
        const lineEnd = state.eMarks[i];
        if (lineStart < lineEnd) {
            const adjust = Math.min(4, state.sCount[i]);
            state.bMarks[i] += adjust;
            state.tShift[i] -= adjust;
            state.sCount[i] -= adjust;
        }
    }

    state.md.block.tokenize(state, startLine + 1, nextLine);

    // Restore state
    for (let i = startLine + 1; i < nextLine; i++) {
        const idx = i - (startLine + 1);
        state.bMarks[i] = oldBMarks[idx];
        state.tShift[i] = oldTShift[idx];
        state.sCount[i] = oldSCount[idx];
    }

    state.parentType = oldParent;
    state.lineMax = oldLineMax;

    state.push('admonition_close', 'div', -1);
    state.line = nextLine;

    return true;
}

/**
 * Render the opening of an admonition as Confluence structured macro.
 */
function renderOpen(tokens, idx) {
    const { type, title, collapsible } = tokens[idx].meta;
    const macroName = TYPE_MAP[type] || 'info';

    let titleParam = '';
    if (title) {
        titleParam = `<ac:parameter ac:name="title">${escapeXml(title)}</ac:parameter>`;
    }

    if (collapsible) {
        // Wrap in expand macro
        const expandTitle = title || type;
        return `<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">${escapeXml(expandTitle)}</ac:parameter><ac:rich-text-body><ac:structured-macro ac:name="${macroName}">${titleParam}<ac:rich-text-body>`;
    }

    return `<ac:structured-macro ac:name="${macroName}">${titleParam}<ac:rich-text-body>`;
}

/**
 * Render the closing of an admonition.
 */
function renderClose(tokens, idx) {
    // Walk backwards to find the matching open token
    let openIdx = idx - 1;
    while (openIdx >= 0 && tokens[openIdx].type !== 'admonition_open') {
        openIdx--;
    }
    const collapsible = openIdx >= 0 && tokens[openIdx].meta.collapsible;

    if (collapsible) {
        return '</ac:rich-text-body></ac:structured-macro></ac:rich-text-body></ac:structured-macro>';
    }

    return '</ac:rich-text-body></ac:structured-macro>';
}

/**
 * Escape XML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export default plugin;
export { TYPE_MAP };
