require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const bodyParser = require('body-parser');
const compression= require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');
const logger     = require('./logger');

// Ensure log directory exists
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Ensure backup directory exists
const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const app = express();

// ── Sentry (init BEFORE any middleware/routes) ─────────────────────────────────
const { initSentry, errorHandler: sentryErrorHandler } = require('./sentry');
initSentry(app); // no-op when SENTRY_DSN_CLOUD is not set

// ── Security & utility middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(compression());

// Restrict CORS to known origins. Set ALLOWED_ORIGINS as a comma-separated list
// in .env for production. Defaults to permissive for local development only.
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : null;
app.use(cors({
    origin: allowedOrigins || function (origin, callback) {
        // Allow requests with no origin (electron, mobile apps, curl)
        if (!origin) return callback(null, true);
        callback(null, true); // dev mode: allow all
    },
    credentials: true,
}));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// ── Rate limiting ──────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true });
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true,
    message: { error: 'Too many auth attempts, try again later' } });

app.use(generalLimiter);

// ── Request logging ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
    next();
});

// ── Static file serving for electron-builder release artifacts ───────────────
// Place built installers + latest.yml here. electron-updater fetches them.
const releasesDir = path.join(__dirname, '../releases');
if (!fs.existsSync(releasesDir)) fs.mkdirSync(releasesDir, { recursive: true });
app.use('/releases', express.static(releasesDir));

// ── Health check (no auth) ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), version: require('../package.json').version });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',    authLimiter, require('./routes/auth'));
app.use('/api/license', require('./routes/license'));
app.use('/api/sync',    require('./routes/sync'));
app.use('/api/updates', require('./routes/updates'));
app.use('/api/admin',   require('./routes/admin'));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
// ── Sentry error handler (must come before custom 500 handler) ────────────────
app.use(sentryErrorHandler);
// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    logger.error('Unhandled error', { err });
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    logger.info(`🚀 Biznex License Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    logger.info(`   Health: http://localhost:${PORT}/health`);
});

module.exports = app;
