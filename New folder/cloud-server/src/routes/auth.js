const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Joi     = require('joi');
const db      = require('../db');
const logger  = require('../logger');
const { requireAuth } = require('../middleware/auth');

// ── helpers ──────────────────────────────────────────────────────────────────
function signAccess(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
}
function signRefresh(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
const registerSchema = Joi.object({
    name:     Joi.string().min(2).max(80).required(),
    email:    Joi.string().email().required(),
    password: Joi.string().min(8).required(),
});

router.post('/register', async (req, res) => {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const existing = await db.query('SELECT id FROM accounts WHERE email=$1', [value.email]);
        if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

        const hash = await bcrypt.hash(value.password, 12);
        const result = await db.query(
            `INSERT INTO accounts (email, password, name) VALUES ($1,$2,$3) RETURNING id,email,name,role,created_at`,
            [value.email, hash, value.name]
        );
        const account = result.rows[0];
        logger.info('Account registered', { accountId: account.id, email: account.email });
        res.status(201).json({ message: 'Account created', account });
    } catch (err) {
        logger.error('Register error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const loginSchema = Joi.object({
    email:    Joi.string().email().required(),
    password: Joi.string().required(),
});

router.post('/login', async (req, res) => {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const result = await db.query(
            'SELECT id,email,name,role,is_active,password FROM accounts WHERE email=$1',
            [value.email]
        );
        const account = result.rows[0];
        if (!account) return res.status(401).json({ error: 'Invalid credentials' });
        if (!account.is_active) return res.status(403).json({ error: 'Account disabled' });

        const valid = await bcrypt.compare(value.password, account.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const payload  = { id: account.id, email: account.email, role: account.role };
        const accessToken   = signAccess(payload);
        const refreshToken  = signRefresh(payload);
        const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Store refresh token
        await db.query(
            `INSERT INTO refresh_tokens (account_id, token, expires_at) VALUES ($1,$2,$3)`,
            [account.id, refreshToken, refreshExpiry]
        );

        logger.info('Account login', { accountId: account.id });
        res.json({
            accessToken,
            refreshToken,
            account: { id: account.id, email: account.email, name: account.name, role: account.role },
        });
    } catch (err) {
        logger.error('Login error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    try {
        const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const row = await db.query(
            `SELECT id FROM refresh_tokens WHERE token=$1 AND expires_at > NOW()`,
            [refreshToken]
        );
        if (!row.rows.length) return res.status(401).json({ error: 'Refresh token invalid or expired' });

        const newAccess = signAccess({ id: payload.id, email: payload.email, role: payload.role });
        res.json({ accessToken: newAccess });
    } catch (err) {
        res.status(401).json({ error: 'Refresh token invalid' });
    }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        await db.query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]).catch(() => {});
    }
    res.json({ message: 'Logged out' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id,email,name,role,created_at FROM accounts WHERE id=$1',
            [req.account.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Account not found' });
        res.json(result.rows[0]);
    } catch (err) {
        logger.error('Me error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
