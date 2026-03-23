import { expect } from 'chai';
import { htmlToMarkdown, markdownToHtml } from '../../../lib/comment-sync/html-to-markdown.js';

describe('comment-sync/html-to-markdown', () => {

    describe('htmlToMarkdown', () => {
        it('should convert simple HTML to markdown', () => {
            const html = '<p>Hello <strong>world</strong></p>';
            const md = htmlToMarkdown(html);
            expect(md).to.include('Hello');
            expect(md).to.include('**world**');
        });

        it('should convert links', () => {
            const html = '<p>Visit <a href="https://example.com">Example</a></p>';
            const md = htmlToMarkdown(html);
            expect(md).to.include('[Example](https://example.com)');
        });

        it('should convert lists', () => {
            const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            const md = htmlToMarkdown(html);
            expect(md).to.include('Item 1');
            expect(md).to.include('Item 2');
        });

        it('should handle empty input', () => {
            expect(htmlToMarkdown('')).to.equal('');
            expect(htmlToMarkdown(null)).to.equal('');
        });
    });

    describe('markdownToHtml', () => {
        it('should wrap text in <p> tags', () => {
            const html = markdownToHtml('Hello world');
            expect(html).to.equal('<p>Hello world</p>');
        });

        it('should convert bold syntax', () => {
            const html = markdownToHtml('**bold**');
            expect(html).to.include('<strong>bold</strong>');
        });

        it('should convert italic syntax', () => {
            const html = markdownToHtml('*italic*');
            expect(html).to.include('<em>italic</em>');
        });

        it('should convert inline code', () => {
            const html = markdownToHtml('use `code` here');
            expect(html).to.include('<code>code</code>');
        });

        it('should escape HTML entities', () => {
            const html = markdownToHtml('a < b & c > d');
            expect(html).to.include('&lt;');
            expect(html).to.include('&amp;');
            expect(html).to.include('&gt;');
        });

        it('should handle empty input', () => {
            expect(markdownToHtml('')).to.equal('');
            expect(markdownToHtml(null)).to.equal('');
        });
    });
});
