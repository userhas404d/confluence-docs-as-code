import { expect } from 'chai';

/**
 * Tests for PushConfig parsing and validation
 */
describe('push-config', () => {
    let parsePushConfig;
    let setActionsInputs;

    const validEnv = {
        CONFLUENCE_TENANT: 'leolabs',
        CONFLUENCE_SPACE: 'TESTSPACE',
        CONFLUENCE_USER: 'user@leolabs.space',
        CONFLUENCE_TOKEN: 'api-token-123'
    };

    beforeEach(async () => {
        const mod = await import('../../../lib/push/push-config.js');
        parsePushConfig = mod.parsePushConfig;
        setActionsInputs = mod.setActionsInputs;
    });

    describe('parsePushConfig', () => {
        describe('with all required CLI flags', () => {
            it('should parse all required parameters from CLI args', () => {
                const args = [
                    '--confluence-tenant', 'leolabs',
                    '--confluence-space', 'TESTSPACE',
                    '--confluence-user', 'user@leolabs.space',
                    '--confluence-token', 'api-token-123'
                ];
                const config = parsePushConfig(args, {});
                expect(config.confluenceTenant).to.equal('leolabs');
                expect(config.confluenceSpace).to.equal('TESTSPACE');
                expect(config.confluenceUser).to.equal('user@leolabs.space');
                expect(config.confluenceToken).to.equal('api-token-123');
            });

            it('should default optional params when not specified', () => {
                const args = [
                    '--confluence-tenant', 'leolabs',
                    '--confluence-space', 'TESTSPACE',
                    '--confluence-user', 'user@leolabs.space',
                    '--confluence-token', 'api-token-123'
                ];
                const config = parsePushConfig(args, {});
                expect(config.confluenceParentPage).to.equal('');
                expect(config.confluenceTitlePrefix).to.equal('');
                expect(config.forceUpdate).to.equal(false);
                expect(config.cleanup).to.equal(false);
                expect(config.krokiEnabled).to.equal('no');
                expect(config.krokiHost).to.equal('https://kroki.io');
                expect(config.mermaidRenderer).to.equal('');
                expect(config.plantumlRenderer).to.equal('');
            });

            it('should accept optional CLI flags', () => {
                const args = [
                    '--confluence-tenant', 'leolabs',
                    '--confluence-space', 'TESTSPACE',
                    '--confluence-user', 'user@leolabs.space',
                    '--confluence-token', 'api-token-123',
                    '--confluence-parent-page', 'My Parent',
                    '--confluence-title-prefix', 'Docs - ',
                    '--force-update',
                    '--cleanup',
                    '--kroki-enabled', 'yes',
                    '--kroki-host', 'https://kroki.example.com',
                    '--mermaid-renderer', 'kroki',
                    '--plantuml-renderer', 'plantuml'
                ];
                const config = parsePushConfig(args, {});
                expect(config.confluenceParentPage).to.equal('My Parent');
                expect(config.confluenceTitlePrefix).to.equal('Docs - ');
                expect(config.forceUpdate).to.equal(true);
                expect(config.cleanup).to.equal(true);
                expect(config.krokiEnabled).to.equal('yes');
                expect(config.krokiHost).to.equal('https://kroki.example.com');
                expect(config.mermaidRenderer).to.equal('kroki');
                expect(config.plantumlRenderer).to.equal('plantuml');
            });
        });

        describe('with environment variables', () => {
            it('should fall back to env vars when no CLI flags given', () => {
                const config = parsePushConfig([], validEnv);
                expect(config.confluenceTenant).to.equal('leolabs');
                expect(config.confluenceSpace).to.equal('TESTSPACE');
                expect(config.confluenceUser).to.equal('user@leolabs.space');
                expect(config.confluenceToken).to.equal('api-token-123');
            });

            it('should read optional env vars', () => {
                const env = {
                    ...validEnv,
                    CONFLUENCE_PARENT_PAGE: 'Parent Title',
                    CONFLUENCE_TITLE_PREFIX: 'Prefix - ',
                    CONFLUENCE_FORCE_UPDATE: 'yes',
                    CONFLUENCE_CLEANUP: 'yes',
                    KROKI_ENABLED: 'yes',
                    KROKI_HOST: 'https://kroki.example.com',
                    MERMAID_RENDERER: 'kroki',
                    PLANTUML_RENDERER: 'plantuml'
                };
                const config = parsePushConfig([], env);
                expect(config.confluenceParentPage).to.equal('Parent Title');
                expect(config.confluenceTitlePrefix).to.equal('Prefix - ');
                expect(config.forceUpdate).to.equal(true);
                expect(config.cleanup).to.equal(true);
                expect(config.krokiEnabled).to.equal('yes');
                expect(config.krokiHost).to.equal('https://kroki.example.com');
                expect(config.mermaidRenderer).to.equal('kroki');
                expect(config.plantumlRenderer).to.equal('plantuml');
            });

            it('should not set forceUpdate when env var is not "yes"', () => {
                const env = { ...validEnv, CONFLUENCE_FORCE_UPDATE: 'no' };
                const config = parsePushConfig([], env);
                expect(config.forceUpdate).to.equal(false);
            });
        });

        describe('CLI flags override env vars', () => {
            it('should prefer CLI flags over env vars', () => {
                const args = [
                    '--confluence-tenant', 'cli-tenant',
                    '--confluence-space', 'CLI_SPACE',
                    '--confluence-user', 'cli@example.com',
                    '--confluence-token', 'cli-token'
                ];
                const env = {
                    CONFLUENCE_TENANT: 'env-tenant',
                    CONFLUENCE_SPACE: 'ENV_SPACE',
                    CONFLUENCE_USER: 'env@example.com',
                    CONFLUENCE_TOKEN: 'env-token'
                };
                const config = parsePushConfig(args, env);
                expect(config.confluenceTenant).to.equal('cli-tenant');
                expect(config.confluenceSpace).to.equal('CLI_SPACE');
                expect(config.confluenceUser).to.equal('cli@example.com');
                expect(config.confluenceToken).to.equal('cli-token');
            });
        });

        describe('validation', () => {
            it('should throw when confluenceTenant is missing', () => {
                expect(() => parsePushConfig([], {})).to.throw('confluenceTenant is required');
            });

            it('should throw when confluenceSpace is missing', () => {
                expect(() => parsePushConfig([], { CONFLUENCE_TENANT: 'x' })).to.throw('confluenceSpace is required');
            });

            it('should throw when confluenceUser is missing', () => {
                expect(() => parsePushConfig([], { CONFLUENCE_TENANT: 'x', CONFLUENCE_SPACE: 'Y' })).to.throw('confluenceUser is required');
            });

            it('should throw when confluenceToken is missing', () => {
                expect(() => parsePushConfig([], {
                    CONFLUENCE_TENANT: 'x',
                    CONFLUENCE_SPACE: 'Y',
                    CONFLUENCE_USER: 'u@x.com'
                })).to.throw('confluenceToken is required');
            });
        });

        describe('ignores unknown flags', () => {
            it('should not throw on unrecognized CLI options', () => {
                const args = [
                    '--confluence-tenant', 'leolabs',
                    '--confluence-space', 'TESTSPACE',
                    '--confluence-user', 'user@leolabs.space',
                    '--confluence-token', 'api-token-123',
                    '--source-dir', './output',
                    '--repo-url', 'https://github.com/org/repo'
                ];
                const config = parsePushConfig(args, {});
                expect(config.confluenceTenant).to.equal('leolabs');
            });
        });
    });

    describe('setActionsInputs', () => {
        let savedEnv;

        beforeEach(() => {
            savedEnv = { ...process.env };
        });

        afterEach(() => {
            // Restore environment
            for (const key of Object.keys(process.env)) {
                if (key.startsWith('INPUT_')) {
                    if (savedEnv[key] === undefined) {
                        delete process.env[key];
                    } else {
                        process.env[key] = savedEnv[key];
                    }
                }
            }
        });

        it('should set all INPUT_* env vars for @actions/core', () => {
            const config = {
                confluenceTenant: 'leolabs',
                confluenceSpace: 'TESTSPACE',
                confluenceUser: 'user@leolabs.space',
                confluenceToken: 'api-token-123',
                confluenceParentPage: 'Parent',
                confluenceTitlePrefix: 'Prefix - ',
                forceUpdate: true,
                cleanup: false,
                krokiEnabled: 'yes',
                krokiHost: 'https://kroki.io',
                mermaidRenderer: 'kroki',
                plantumlRenderer: 'plantuml'
            };

            setActionsInputs(config);

            expect(process.env.INPUT_CONFLUENCE_TENANT).to.equal('leolabs');
            expect(process.env.INPUT_CONFLUENCE_SPACE).to.equal('TESTSPACE');
            expect(process.env.INPUT_CONFLUENCE_USER).to.equal('user@leolabs.space');
            expect(process.env.INPUT_CONFLUENCE_TOKEN).to.equal('api-token-123');
            expect(process.env.INPUT_CONFLUENCE_PARENT_PAGE).to.equal('Parent');
            expect(process.env.INPUT_CONFLUENCE_TITLE_PREFIX).to.equal('Prefix - ');
            expect(process.env.INPUT_CONFLUENCE_FORCE_UPDATE).to.equal('yes');
            expect(process.env.INPUT_CONFLUENCE_CLEANUP).to.equal('no');
            expect(process.env.INPUT_KROKI_ENABLED).to.equal('yes');
            expect(process.env.INPUT_KROKI_HOST).to.equal('https://kroki.io');
            expect(process.env.INPUT_MERMAID_RENDERER).to.equal('kroki');
            expect(process.env.INPUT_PLANTUML_RENDERER).to.equal('plantuml');
        });

        it('should set force_update to "no" when false', () => {
            const config = {
                confluenceTenant: 'x',
                confluenceSpace: 'Y',
                confluenceUser: 'u@x.com',
                confluenceToken: 'tok',
                confluenceParentPage: '',
                confluenceTitlePrefix: '',
                forceUpdate: false,
                cleanup: false,
                krokiEnabled: 'no',
                krokiHost: 'https://kroki.io',
                mermaidRenderer: '',
                plantumlRenderer: ''
            };

            setActionsInputs(config);

            expect(process.env.INPUT_CONFLUENCE_FORCE_UPDATE).to.equal('no');
            expect(process.env.INPUT_CONFLUENCE_CLEANUP).to.equal('no');
        });

        it('should set cleanup to "yes" when true', () => {
            const config = {
                confluenceTenant: 'x',
                confluenceSpace: 'Y',
                confluenceUser: 'u@x.com',
                confluenceToken: 'tok',
                confluenceParentPage: '',
                confluenceTitlePrefix: '',
                forceUpdate: false,
                cleanup: true,
                krokiEnabled: 'no',
                krokiHost: 'https://kroki.io',
                mermaidRenderer: '',
                plantumlRenderer: ''
            };

            setActionsInputs(config);

            expect(process.env.INPUT_CONFLUENCE_CLEANUP).to.equal('yes');
        });
    });
});
