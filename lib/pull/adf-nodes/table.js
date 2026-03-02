/**
 * @module pull/adf-nodes/table
 * @description ADF table handler — converts to Markdown pipe tables.
 */
import { registerHandler, convertChildren } from './index.js';

/**
 * Handler for table nodes.
 * Outputs Markdown pipe table with header separator row.
 *
 * @param {object} node - ADF table node
 * @param {object} context - Conversion context
 * @returns {string} Markdown pipe table
 */
registerHandler('table', (node, context) => {
    const rows = node.content || [];
    if (rows.length === 0) return '';

    const tableRows = [];
    let hasHeaderRow = false;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.content || [];

        // Check if this is a header row (contains tableHeader cells)
        const isHeaderRow = cells.some(cell => cell.type === 'tableHeader');

        // Convert cells to text
        const cellTexts = cells.map(cell => {
            const cellContent = convertChildren(cell.content || [], { ...context, inlineMode: true });
            // Strip trailing newlines from cell content
            return cellContent.replace(/\n+$/, '').replace(/\n/g, ' ');
        });

        const pipeRow = `| ${cellTexts.join(' | ')} |`;
        tableRows.push(pipeRow);

        // Add header separator after header row
        if (isHeaderRow && !hasHeaderRow) {
            hasHeaderRow = true;
            const separator = `| ${cellTexts.map(() => '---').join(' | ')} |`;
            tableRows.push(separator);
        }
    }

    // If no header row detected but table has data rows, add empty header + separator
    if (!hasHeaderRow && tableRows.length > 0) {
        const firstRow = rows[0];
        const colCount = (firstRow.content || []).length;
        const emptyHeader = `| ${Array(colCount).fill(' ').join(' | ')} |`;
        const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
        tableRows.unshift(emptyHeader, separator);
    }

    return tableRows.join('\n') + '\n';
});

/**
 * Handler for tableRow — used when table handler delegates to children.
 * This is handled by the table handler itself.
 */
registerHandler('tableRow', (node, context) => {
    return convertChildren(node.content || [], context);
});

/**
 * Handler for tableHeader cells.
 */
registerHandler('tableHeader', (node, context) => {
    return convertChildren(node.content || [], { ...context, inlineMode: true });
});

/**
 * Handler for tableCell cells.
 */
registerHandler('tableCell', (node, context) => {
    return convertChildren(node.content || [], { ...context, inlineMode: true });
});
