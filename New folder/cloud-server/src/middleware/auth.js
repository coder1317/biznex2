const jwt    = require('jsonwebtoken');
const db     = require('../db');
const logger = require('../logger');

/**
 * Middleware: verifies Bearer JWT for portal/admin API calls.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.account = payload;
        next();
    } catch (err) {
        logger.warn('Auth middleware: invalid token', { err: err.message });
        return res.status(401).json({ error: 'Token invalid or expired' });
    }
}

/**
 * Middleware: requires the authenticated account to have role='admin'.
 */
function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.account.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
}

module.exports = { requireAuth, requireAdmin };
