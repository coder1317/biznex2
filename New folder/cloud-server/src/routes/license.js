const router = require('express').Router();
const crypto = require('crypto');
const Joi    = require('joi');
const db     = require('../db');
const logger = require('../logger');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ── helpers ──────────────────────────────────────────────────────────────────
/**
 * Generate a license key in format: BZNX-XXXX-XXXX-XXXX-XXXX
 */
function generateKey() {
    const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    return `BZNX-${seg()}${seg()}-${seg()}${seg()}-${seg()}${seg()}-${seg()}${seg()}`;
}

// ── POST /api/license/generate  (admin only) ─────────────────────────────────
const generateSchema = Joi.object({
    account_id: Joi.number().integer().required(),
    // Accept both naming conventions: starter/business/enterprise (app+portal) and standard/pro/enterprise (legacy cloud)
    plan:       Joi.string().valid('starter', 'business', 'enterprise', 'standard', 'pro').default('starter'),
    max_seats:  Joi.number().integer().min(1).max(100).default(1),
    expires_at: Joi.date().iso().allow(null).default(null),
    notes:      Joi.string().max(500).allow('', null).default(null),
});

router.post('/generate', requireAdmin, async (req, res) => {
    const { error, value } = generateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const acct = await db.query('SELECT id FROM accounts WHERE id=$1', [value.account_id]);
        if (!acct.rows.length) return res.status(404).json({ error: 'Account not found' });

        const key = generateKey();
        const result = await db.query(
            `INSERT INTO license_keys (key,account_id,plan,max_seats,expires_at,notes)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [key, value.account_id, value.plan, value.max_seats, value.expires_at, value.notes]
        );
        logger.info('License key generated', { key, accountId: value.account_id });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        logger.error('Generate key error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── POST /api/license/activate ───────────────────────────────────────────────
const activateSchema = Joi.object({
    key:         Joi.string().required(),
    device_id:   Joi.string().min(8).max(128).required(),
    device_name: Joi.string().max(100).allow('', null).default(null),
});

router.post('/activate', async (req, res) => {
    const { error, value } = activateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        // Look up the key
        const keyResult = await db.query(
            `SELECT * FROM license_keys WHERE key=$1 AND is_active=TRUE`,
            [value.key]
        );
        if (!keyResult.rows.length) return res.status(404).json({ error: 'License key not found or inactive' });
        const licenseKey = keyResult.rows[0];

        // Check expiry
        if (licenseKey.expires_at && new Date(licenseKey.expires_at) < new Date()) {
            return res.status(403).json({ error: 'License key has expired' });
        }

        // Check if this device is already activated
        const existing = await db.query(
            `SELECT id FROM activations WHERE license_key_id=$1 AND device_id=$2`,
            [licenseKey.id, value.device_id]
        );

        if (existing.rows.length) {
            // Re-activation: update last_seen and re-enable
            await db.query(
                `UPDATE activations SET last_seen_at=NOW(), is_active=TRUE, device_name=$1
                 WHERE license_key_id=$2 AND device_id=$3`,
                [value.device_name, licenseKey.id, value.device_id]
            );
            logger.info('License re-activated', { key: value.key, deviceId: value.device_id });
        } else {
            // Count active seats
            const seats = await db.query(
                `SELECT COUNT(*) FROM activations WHERE license_key_id=$1 AND is_active=TRUE`,
                [licenseKey.id]
            );
            if (parseInt(seats.rows[0].count) >= licenseKey.max_seats) {
                return res.status(403).json({
                    error: `Seat limit reached (${licenseKey.max_seats} seat${licenseKey.max_seats > 1 ? 's' : ''})`,
                });
            }
            await db.query(
                `INSERT INTO activations (license_key_id,device_id,device_name) VALUES ($1,$2,$3)`,
                [licenseKey.id, value.device_id, value.device_name]
            );
            logger.info('License activated', { key: value.key, deviceId: value.device_id });
        }

        // Return a signed license token the app stores locally
        const payload = {
            licenseKey:   value.key,
            deviceId:     value.device_id,
            plan:         licenseKey.plan,
            maxSeats:     licenseKey.max_seats,
            expiresAt:    licenseKey.expires_at,
            validatedAt:  new Date().toISOString(),
        };
        const licenseToken = require('jsonwebtoken').sign(payload, process.env.JWT_SECRET, {
            expiresIn: `${process.env.OFFLINE_GRACE_DAYS || 7}d`,
        });

        res.json({ success: true, licenseToken, plan: licenseKey.plan });
    } catch (err) {
        logger.error('Activation error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── POST /api/license/validate ───────────────────────────────────────────────
const validateSchema = Joi.object({
    key:       Joi.string().required(),
    device_id: Joi.string().required(),
});

router.post('/validate', async (req, res) => {
    const { error, value } = validateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const result = await db.query(
            `SELECT lk.plan, lk.expires_at, lk.is_active, a.is_active AS activation_active
             FROM license_keys lk
             JOIN activations a ON a.license_key_id = lk.id
             WHERE lk.key=$1 AND a.device_id=$2`,
            [value.key, value.device_id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ valid: false, reason: 'Not activated on this device' });
        }

        const row = result.rows[0];
        if (!row.is_active)            return res.json({ valid: false, reason: 'License key revoked' });
        if (!row.activation_active)    return res.json({ valid: false, reason: 'Activation revoked' });
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
            return res.json({ valid: false, reason: 'License expired' });
        }

        // Update last seen
        await db.query(
            `UPDATE activations SET last_seen_at=NOW()
             WHERE license_key_id=(SELECT id FROM license_keys WHERE key=$1) AND device_id=$2`,
            [value.key, value.device_id]
        );

        // Issue fresh license token
        const payload = {
            licenseKey:  value.key,
            deviceId:    value.device_id,
            plan:        row.plan,
            expiresAt:   row.expires_at,
            validatedAt: new Date().toISOString(),
        };
        const licenseToken = require('jsonwebtoken').sign(payload, process.env.JWT_SECRET, {
            expiresIn: `${process.env.OFFLINE_GRACE_DAYS || 7}d`,
        });

        res.json({ valid: true, plan: row.plan, licenseToken });
    } catch (err) {
        logger.error('Validate error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── POST /api/license/deactivate ─────────────────────────────────────────────
router.post('/deactivate', requireAuth, async (req, res) => {
    const { key, device_id } = req.body;
    if (!key || !device_id) return res.status(400).json({ error: 'key and device_id required' });

    try {
        // Customers can only deactivate their own keys; admins can deactivate any
        const keyResult = await db.query(
            `SELECT lk.id, lk.account_id FROM license_keys lk WHERE lk.key=$1`,
            [key]
        );
        if (!keyResult.rows.length) return res.status(404).json({ error: 'Key not found' });

        const licKey = keyResult.rows[0];
        if (req.account.role !== 'admin' && licKey.account_id !== req.account.id) {
            return res.status(403).json({ error: 'Not your license key' });
        }

        await db.query(
            `UPDATE activations SET is_active=FALSE
             WHERE license_key_id=$1 AND device_id=$2`,
            [licKey.id, device_id]
        );
        logger.info('License deactivated', { key, device_id });
        res.json({ success: true });
    } catch (err) {
        logger.error('Deactivate error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/license/my-keys  (authenticated customer) ───────────────────────
router.get('/my-keys', requireAuth, async (req, res) => {
    try {
        const keys = await db.query(
            `SELECT lk.*, 
                (SELECT COUNT(*) FROM activations a WHERE a.license_key_id=lk.id AND a.is_active=TRUE) AS active_seats
             FROM license_keys lk WHERE lk.account_id=$1 ORDER BY lk.created_at DESC`,
            [req.account.id]
        );
        res.json(keys.rows);
    } catch (err) {
        logger.error('My-keys error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
