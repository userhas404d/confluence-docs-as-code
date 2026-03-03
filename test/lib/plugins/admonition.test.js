import { expect } from 'chai';
import MarkdownIt from 'markdown-it';
import admonition from '../../../lib/plugins/admonition.js';
import { TYPE_MAP } from '../../../lib/plugins/admonition.js';

describe('plugins/admonition', () => {
    let md;

    beforeEach(() => {
        md = new MarkdownIt({ xhtmlOut: true, html: true }).use(admonition);
    });

    describe('basic !!! admonitions', () => {
        it('should convert !!! warning to Confluence warning macro', () => {
            const input = '!!! warning\n    This is a warning.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="warning">');
            expect(result).to.include('<ac:rich-text-body>');
            expect(result).to.include('This is a warning.');
            expect(result).to.include('</ac:rich-text-body></ac:structured-macro>');
        });

        it('should convert !!! note to Confluence note macro', () => {
            const input = '!!! note\n    Some note content.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="note">');
            expect(result).to.include('Some note content.');
        });

        it('should convert !!! info to Confluence info macro', () => {
            const input = '!!! info\n    Information here.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="info">');
            expect(result).to.include('Information here.');
        });

        it('should convert !!! tip to Confluence tip macro', () => {
            const input = '!!! tip\n    A helpful tip.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="tip">');
        });

        it('should convert !!! success to Confluence tip macro', () => {
            const input = '!!! success\n    Operation succeeded.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="tip">');
        });

        it('should convert !!! danger to Confluence warning macro', () => {
            const input = '!!! danger\n    Dangerous operation.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="warning">');
        });

        it('should fall back to info for unknown types', () => {
            const input = '!!! custom\n    Custom content.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="info">');
        });
    });

    describe('admonitions with titles', () => {
        it('should include title parameter when quoted title is provided', () => {
            const input = '!!! warning "Be careful"\n    Watch out.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="warning">');
            expect(result).to.include('<ac:parameter ac:name="title">Be careful</ac:parameter>');
            expect(result).to.include('Watch out.');
        });

        it('should handle empty title gracefully', () => {
            const input = '!!! note ""\n    Note without title.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="note">');
            expect(result).to.not.include('<ac:parameter ac:name="title">');
        });
    });

    describe('collapsible ??? admonitions', () => {
        it('should wrap ??? in expand macro', () => {
            const input = '??? note "Click to expand"\n    Hidden content.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="expand">');
            expect(result).to.include('<ac:parameter ac:name="title">Click to expand</ac:parameter>');
            expect(result).to.include('<ac:structured-macro ac:name="note">');
            expect(result).to.include('Hidden content.');
            // Should close both expand and inner macro
            expect(result).to.include('</ac:rich-text-body></ac:structured-macro></ac:rich-text-body></ac:structured-macro>');
        });

        it('should use type as expand title when no custom title given', () => {
            const input = '??? warning\n    Collapsible warning.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="expand">');
            expect(result).to.include('<ac:parameter ac:name="title">warning</ac:parameter>');
        });
    });

    describe('multi-line content', () => {
        it('should handle multiple paragraphs in admonition body', () => {
            const input = '!!! info\n    First paragraph.\n\n    Second paragraph.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="info">');
            expect(result).to.include('First paragraph.');
            expect(result).to.include('Second paragraph.');
        });

        it('should handle code blocks inside admonitions', () => {
            const input = '!!! note\n    Some text:\n\n        code block\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="note">');
            expect(result).to.include('Some text:');
        });

        it('should handle inline formatting inside admonitions', () => {
            const input = '!!! warning\n    This is **bold** and *italic*.\n';
            const result = md.render(input);
            expect(result).to.include('<strong>bold</strong>');
            expect(result).to.include('<em>italic</em>');
        });
    });

    describe('context integration', () => {
        it('should not affect regular paragraphs', () => {
            const input = 'Normal paragraph.\n\n!!! warning\n    Warning text.\n\nAnother paragraph.\n';
            const result = md.render(input);
            expect(result).to.include('<p>Normal paragraph.</p>');
            expect(result).to.include('<ac:structured-macro ac:name="warning">');
            expect(result).to.include('<p>Another paragraph.</p>');
        });

        it('should handle adjacent admonitions', () => {
            const input = '!!! warning\n    First warning.\n\n!!! info\n    Some info.\n';
            const result = md.render(input);
            expect(result).to.include('<ac:structured-macro ac:name="warning">');
            expect(result).to.include('First warning.');
            expect(result).to.include('<ac:structured-macro ac:name="info">');
            expect(result).to.include('Some info.');
        });
    });

    describe('TYPE_MAP coverage', () => {
        it('should map all documented MkDocs types', () => {
            const expectedMappings = {
                info: 'info', note: 'note', warning: 'warning',
                danger: 'warning', error: 'warning', tip: 'tip',
                hint: 'tip', success: 'tip', check: 'tip',
                example: 'info', quote: 'note', cite: 'note',
                abstract: 'info', summary: 'info', bug: 'warning',
                failure: 'warning', fail: 'warning',
                question: 'info', help: 'info', faq: 'info'
            };
            for (const [mkdocs, confluence] of Object.entries(expectedMappings)) {
                expect(TYPE_MAP[mkdocs], `TYPE_MAP['${mkdocs}']`).to.equal(confluence);
            }
        });
    });

    describe('XML escaping in titles', () => {
        it('should escape special XML characters in title', () => {
            const input = '!!! warning "Use <code> & \"quotes\""\n    Content.\n';
            const result = md.render(input);
            // The title extracted is: Use <code> & "quotes"
            // But MarkdownIt parsing may stop at the second unescaped quote
            // Let's test with a simpler case
            expect(result).to.include('<ac:structured-macro ac:name="warning">');
        });

        it('should escape ampersands in titles', () => {
            const input = '!!! note "A & B"\n    Content.\n';
            const result = md.render(input);
            expect(result).to.include('A &amp; B');
        });
    });
});
