import { expect } from 'chai';
import { parseArgs } from 'node:util';

/**
 * T058: Tests for PullConfig parsing and validation
 */
describe('pull-config', () => {
    let parsePullConfig;
    const validEnv = {
        CONFLUENCE_URL: 'https://leolabs.atlassian.net',
        CONFLUENCE_USER: 'user@leolabs.space',
        CONFLUENCE_TOKEN: 'api-token-123',
        CONFLUENCE_ROOT_ID: '2134835234'
    };

    beforeEach(async () => {
        const mod = await import('../../../lib/pull/pull-config.js');
        parsePullConfig = mod.parsePullConfig;
    });

    describe('with all required CLI flags', () => {
        it('should parse all required parameters from CLI args', () => {
            const args = [
                '--confluence-url', 'https://leolabs.atlassian.net',
                '--confluence-user', 'user@leolabs.space',
                '--confluence-token', 'api-token-123',
                '--root-page-id', '2134835234'
            ];
            const config = parsePullConfig(args, {});
            expect(config.confluenceUrl).to.equal('https://leolabs.atlassian.net');
            expect(config.confluenceUser).to.equal('user@leolabs.space');
            expect(config.confluenceToken).to.equal('api-token-123');
            expect(config.rootPageId).to.equal('2134835234');
        });

        it('should use default outputDir when not specified', () => {
            const args = [
                '--confluence-url', 'https://leolabs.atlassian.net',
                '--confluence-user', 'user@leolabs.space',
                '--confluence-token', 'api-token-123',
                '--root-page-id', '2134835234'
            ];
            const config = parsePullConfig(args, {});
            expect(config.outputDir).to.equal('./output');
        });

        it('should accept custom outputDir via CLI flag', () => {
            const args = [
                '--confluence-url', 'https://leolabs.atlassian.net',
                '--confluence-user', 'user@leolabs.space',
                '--confluence-token', 'api-token-123',
                '--root-page-id', '2134835234',
                '--output-dir', './my-docs'
            ];
            const config = parsePullConfig(args, {});
            expect(config.outputDir).to.equal('./my-docs');
        });
    });

    describe('with environment variables', () => {
        it('should parse all required parameters from env vars', () => {
            const config = parsePullConfig([], validEnv);
            expect(config.confluenceUrl).to.equal('https://leolabs.atlassian.net');
            expect(config.confluenceUser).to.equal('user@leolabs.space');
            expect(config.confluenceToken).to.equal('api-token-123');
            expect(config.rootPageId).to.equal('2134835234');
        });

        it('should accept OUTPUT_DIR env var', () => {
            const config = parsePullConfig([], { ...validEnv, OUTPUT_DIR: './custom' });
            expect(config.outputDir).to.equal('./custom');
        });
    });

    describe('CLI flags take precedence over env vars', () => {
        it('should prefer CLI flag over env var', () => {
            const args = [
                '--confluence-url', 'https://override.atlassian.net',
                '--confluence-user', 'override@user.com',
                '--confluence-token', 'override-token',
                '--root-page-id', '9999999'
            ];
            const env = { ...validEnv };
            const config = parsePullConfig(args, env);
            expect(config.confluenceUrl).to.equal('https://override.atlassian.net');
            expect(config.confluenceUser).to.equal('override@user.com');
            expect(config.confluenceToken).to.equal('override-token');
            expect(config.rootPageId).to.equal('9999999');
        });
    });

    describe('validation errors', () => {
        it('should throw when confluenceUrl is missing', () => {
            expect(() => parsePullConfig([], {})).to.throw(/confluenceUrl.*required/i);
        });

        it('should throw when confluenceUser is missing', () => {
            const env = { CONFLUENCE_URL: 'https://x.atlassian.net' };
            expect(() => parsePullConfig([], env)).to.throw(/confluenceUser.*required/i);
        });

        it('should throw when confluenceToken is missing', () => {
            const env = {
                CONFLUENCE_URL: 'https://x.atlassian.net',
                CONFLUENCE_USER: 'user@x.com'
            };
            expect(() => parsePullConfig([], env)).to.throw(/confluenceToken.*required/i);
        });

        it('should throw when rootPageId is missing', () => {
            const env = {
                CONFLUENCE_URL: 'https://x.atlassian.net',
                CONFLUENCE_USER: 'user@x.com',
                CONFLUENCE_TOKEN: 'token'
            };
            expect(() => parsePullConfig([], env)).to.throw(/rootPageId.*required/i);
        });

        it('should throw when confluenceUrl does not start with https://', () => {
            const env = { ...validEnv, CONFLUENCE_URL: 'http://insecure.net' };
            expect(() => parsePullConfig([], env)).to.throw(/https:\/\//i);
        });
    });
});
