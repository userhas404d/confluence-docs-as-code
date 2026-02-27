import { parseInfoString } from '../../../lib/plugins/fence.js';

describe('plugins/fence', () => {
    describe('parseInfoString', () => {
        it('should parse a simple language', () => {
            const result = parseInfoString('python');
            result.should.deep.equal({
                language: 'python',
                title: '',
                linenums: '',
            });
        });

        it('should parse language with title', () => {
            const result = parseInfoString('python title="main.py"');
            result.should.deep.equal({
                language: 'python',
                title: 'main.py',
                linenums: '',
            });
        });

        it('should parse language with linenums', () => {
            const result = parseInfoString('js linenums="1"');
            result.should.deep.equal({
                language: 'js',
                title: '',
                linenums: '1',
            });
        });

        it('should parse language with both title and linenums', () => {
            const result = parseInfoString('yaml title="config.yml" linenums="5"');
            result.should.deep.equal({
                language: 'yaml',
                title: 'config.yml',
                linenums: '5',
            });
        });

        it('should handle empty info string', () => {
            const result = parseInfoString('');
            result.should.deep.equal({
                language: '',
                title: '',
                linenums: '',
            });
        });

        it('should handle null/undefined info string', () => {
            const result = parseInfoString(null);
            result.should.deep.equal({
                language: '',
                title: '',
                linenums: '',
            });
        });

        it('should handle whitespace-only info string', () => {
            const result = parseInfoString('   ');
            result.should.deep.equal({
                language: '',
                title: '',
                linenums: '',
            });
        });
    });
});
