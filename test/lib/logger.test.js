import sinon from 'sinon';
import esmock from 'esmock';

const sandbox = sinon.createSandbox();

describe('logger', () => {
    let logger;
    let coreSpy;
    beforeEach(async () => {
        coreSpy = {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warning: sandbox.stub(),
            notice: sandbox.stub(),
            debug: sandbox.stub(),
            isDebug: sandbox.stub(),
            setFailed: sandbox.stub(),
            summary: {}
        };
        logger = await esmock('../../lib/logger.js', {
            '@actions/core': coreSpy
        });
        logger = logger.default;
    });
    afterEach(() => {
        sandbox.restore();
    });
    describe('info', () => {
        it('log an info message via actions core', () => {
            const message = 'my message';
            logger.info(message);
            sandbox.assert.calledOnceWithExactly(coreSpy.info, message);
        });
    });
    describe('notice', () => {
        it('log a notice message via actions core', () => {
            const message = 'my message';
            logger.notice(message);
            sandbox.assert.calledOnceWithExactly(coreSpy.notice, message);
        });
    });
    describe('error', () => {
        it('log an error message via actions core', () => {
            const message = 'my message';
            logger.error(message);
            sandbox.assert.calledOnceWithExactly(coreSpy.error, message);
        });
    });
    describe('warning', () => {
        it('log a warning message via actions core', () => {
            const message = 'my message';
            logger.warn(message);
            sandbox.assert.calledOnceWithExactly(coreSpy.warning, message);
        });
    });
    describe('debug', () => {
        it('log a debug message via actions core', () => {
            const message = 'my message';
            logger.debug(message);
            sandbox.assert.calledOnceWithExactly(coreSpy.debug, message);
        });
    });
    describe('fail', () => {
        it('log a failure message via actions core', () => {
            const message = 'my message';
            logger.fail(message);
            sandbox.assert.calledOnceWithExactly(coreSpy.setFailed, message);
        });
    });
    describe('isDebug', () => {
        it('isDebug is delegated to core.isDebug', () => {
            logger.isDebug();
            sandbox.assert.calledOnce(coreSpy.isDebug);
        });
    });
});
