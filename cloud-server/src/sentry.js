/**
 * Sentry crash reporting — Cloud Licensing Server
 *
 * Usage in src/index.js:
 *   const { initSentry, errorHandler } = require('./sentry');
 *   initSentry(app);   // before routes
 *   // ...routes...
 *   app.use(errorHandler);   // last middleware
 */

const SENSITIVE_KEYS = /password|secret|token|key|auth|credentials|session/i;

let _sentry = null;

/**
 * @param {import('express').Application} app
 */
function initSentry(app) {
    const dsn = process.env.SENTRY_DSN_CLOUD;
    if (!dsn) return;

    try {
        const Sentry = require('@sentry/node');

        Sentry.init({
            dsn,
            release: `biznex-cloud-server@${process.env.npm_package_version || '1.0.0'}`,
            environment: process.env.NODE_ENV || 'production',
            sampleRate: 1.0,
            attachStacktrace: true,
            beforeSend: scrubEvent,
        });

        _sentry = Sentry;

        app.use(Sentry.Handlers.requestHandler());
        app.use(Sentry.Handlers.tracingHandler());

        console.log('[Sentry] Initialised for cloud server');
    } catch (err) {
        console.error('[Sentry] Failed to initialise:', err.message);
    }
}

function errorHandler(err, req, res, next) {
    if (_sentry) {
        _sentry.Handlers.errorHandler()(err, req, res, next);
    } else {
        next(err);
    }
}

function captureException(err, extras = {}) {
    if (!_sentry) return;
    try {
        _sentry.withScope((scope) => {
            Object.entries(extras).forEach(([k, v]) => scope.setExtra(k, v));
            _sentry.captureException(err);
        });
    } catch (_) { /* silent */ }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scrubEvent(event) {
    try { scrubObject(event); } catch (_) {}
    return event;
}

function scrubObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
        if (SENSITIVE_KEYS.test(key)) {
            obj[key] = '[Scrubbed]';
        } else {
            scrubObject(obj[key]);
        }
    }
}

module.exports = { initSentry, errorHandler, captureException };
