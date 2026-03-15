const router = require('express').Router();
const bcrypt = require('bcrypt');
const Joi    = require('joi');
const db     = require('../db');
const logger = require('../logger');
const { requireAdmin } = require('../middleware/auth');

// All routes in this file are admin-only
router.use(requireAdmin);

// ── GET /api/admin/accounts ───────────────────────────────────────────────────
router.get('/accounts', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT a.id, a.email, a.name, a.role, a.is_active, a.created_at,
                (SELECT COUNT(*) FROM license_keys lk WHERE lk.account_id=a.id) AS license_count
             FROM accounts a ORDER BY a.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        logger.error('Admin accounts error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/admin/accounts/:id ───────────────────────────────────────────────
router.get('/accounts/:id', async (req, res) => {
    try {
        const acct = await db.query(
            'SELECT id,email,name,role,is_active,created_at FROM accounts WHERE id=$1',
            [req.params.id]
        );
        if (!acct.rows.length) return res.status(404).json({ error: 'Not found' });

        const keys = await db.query(
            `SELECT lk.*,
                (SELECT COUNT(*) FROM activations a WHERE a.license_key_id=lk.id AND a.is_active=TRUE) AS active_seats
             FROM license_keys lk WHERE lk.account_id=$1 ORDER BY lk.created_at DESC`,
            [req.params.id]
        );
        res.json({ account: acct.rows[0], licenseKeys: keys.rows });
    } catch (err) {
        logger.error('Admin get account error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── PATCH /api/admin/accounts/:id ─────────────────────────────────────────────
const patchAccountSchema = Joi.object({
    name:      Joi.string().min(2).max(80),
    is_active: Joi.boolean(),
    role:      Joi.string().valid('customer', 'admin'),
    password:  Joi.string().min(8),
});

router.patch('/accounts/:id', async (req, res) => {
    const { error, value } = patchAccountSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        if (value.password) {
            value.password = await bcrypt.hash(value.password, 12);
        }
        const sets   = Object.keys(value).map((k, i) => `${k}=$${i + 2}`).join(', ');
        const values = [req.params.id, ...Object.values(value)];
        if (!sets) return res.status(400).json({ error: 'Nothing to update' });

        await db.query(`UPDATE accounts SET ${sets}, updated_at=NOW() WHERE id=$1`, values);
        res.json({ success: true });
    } catch (err) {
        logger.error('Admin patch account error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/admin/licenses ───────────────────────────────────────────────────
router.get('/licenses', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT lk.*, a.email AS account_email, a.name AS account_name,
                (SELECT COUNT(*) FROM activations ac WHERE ac.license_key_id=lk.id AND ac.is_active=TRUE) AS active_seats
             FROM license_keys lk
             JOIN accounts a ON a.id=lk.account_id
             ORDER BY lk.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        logger.error('Admin licenses error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── PATCH /api/admin/licenses/:id ─────────────────────────────────────────────
router.patch('/licenses/:id', async (req, res) => {
    const { is_active, max_seats, expires_at, notes } = req.body;
    try {
        await db.query(
            `UPDATE license_keys
             SET is_active=COALESCE($2,is_active),
                 max_seats=COALESCE($3,max_seats),
                 expires_at=COALESCE($4,expires_at),
                 notes=COALESCE($5,notes),
                 updated_at=NOW()
             WHERE id=$1`,
            [req.params.id, is_active, max_seats, expires_at, notes]
        );
        res.json({ success: true });
    } catch (err) {
        logger.error('Admin patch license error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/admin/activations ────────────────────────────────────────────────
router.get('/activations', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ac.*, lk.key AS license_key, acct.email AS account_email
             FROM activations ac
             JOIN license_keys lk ON lk.id=ac.license_key_id
             JOIN accounts acct ON acct.id=lk.account_id
             ORDER BY ac.last_seen_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        logger.error('Admin activations error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [accounts, keys, activations, backups] = await Promise.all([
            db.query('SELECT COUNT(*) FROM accounts WHERE role=\'customer\''),
            db.query('SELECT COUNT(*) FROM license_keys WHERE is_active=TRUE'),
            db.query('SELECT COUNT(*) FROM activations WHERE is_active=TRUE'),
            db.query('SELECT COUNT(*) FROM sync_backups'),
        ]);
        res.json({
            customers:        parseInt(accounts.rows[0].count),
            activeLicenses:   parseInt(keys.rows[0].count),
            activeActivations:parseInt(activations.rows[0].count),
            totalBackups:     parseInt(backups.rows[0].count),
        });
    } catch (err) {
        logger.error('Admin stats error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
