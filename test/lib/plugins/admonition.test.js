import { parseAdmonitionLine, mapType } from '../../../lib/plugins/admonition.js';

describe('plugins/admonition', () => {
    describe('parseAdmonitionLine', () => {
        it('should parse a basic admonition', () => {
            const result = parseAdmonitionLine('!!! note');
            result.should.deep.equal({
                type: 'note',
                title: 'Note',
                collapsible: false,
                expanded: false,
            });
        });

        it('should parse an admonition with custom title', () => {
            const result = parseAdmonitionLine('!!! warning "Custom Warning Title"');
            result.should.deep.equal({
                type: 'warning',
                title: 'Custom Warning Title',
                collapsible: false,
                expanded: false,
            });
        });

        it('should parse an admonition with empty title', () => {
            const result = parseAdmonitionLine('!!! tip ""');
            result.should.deep.equal({
                type: 'tip',
                title: '',
                collapsible: false,
                expanded: false,
            });
        });

        it('should parse a collapsible admonition', () => {
            const result = parseAdmonitionLine('??? note "Click to expand"');
            result.should.deep.equal({
                type: 'note',
                title: 'Click to expand',
                collapsible: true,
                expanded: false,
            });
        });

        it('should parse an initially-expanded collapsible admonition', () => {
            const result = parseAdmonitionLine('???+ info');
            result.should.deep.equal({
                type: 'info',
                title: 'Info',
                collapsible: true,
                expanded: true,
            });
        });

        it('should return null for non-admonition lines', () => {
            const result = parseAdmonitionLine('This is regular text');
            (result === null).should.be.true;
        });

        it('should return null for lines with wrong marker count', () => {
            const result = parseAdmonitionLine('!! note');
            (result === null).should.be.true;
        });
    });

    describe('mapType', () => {
        it('should map note to note', () => {
            mapType('note').should.equal('note');
        });

        it('should map tip to tip', () => {
            mapType('tip').should.equal('tip');
        });

        it('should map hint to tip', () => {
            mapType('hint').should.equal('tip');
        });

        it('should map warning to warning', () => {
            mapType('warning').should.equal('warning');
        });

        it('should map danger to warning', () => {
            mapType('danger').should.equal('warning');
        });

        it('should map info to info', () => {
            mapType('info').should.equal('info');
        });

        it('should map abstract to info', () => {
            mapType('abstract').should.equal('info');
        });

        it('should map unknown types to info', () => {
            mapType('custom').should.equal('info');
        });

        it('should be case-insensitive', () => {
            mapType('NOTE').should.equal('note');
            mapType('Warning').should.equal('warning');
        });
    });
});
