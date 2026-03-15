const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db     = require('../db');
const logger = require('../logger');
const { requireAuth } = require('../middleware/auth');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Keep only the latest N backups per activation
const MAX_BACKUPS_PER_ACTIVATION = 5;

// Multer: accept the SQLite file (max 200 MB)
const upload = multer({
    dest: BACKUP_DIR,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(db|sqlite|sqlite3)$/i)) {
            return cb(new Error('Only .db / .sqlite files allowed'));
        }
        cb(null, true);
    },
});

// ── helper: resolve activation from request ───────────────────────────────────
async function getActivation(accountId, deviceId, licenseKey) {
    const result = await db.query(
        `SELECT a.id FROM activations a
         JOIN license_keys lk ON lk.id = a.license_key_id
         WHERE lk.key=$1 AND a.device_id=$2 AND lk.account_id=$3
           AND a.is_active=TRUE AND lk.is_active=TRUE`,
        [licenseKey, deviceId, accountId]
    );
    return result.rows[0] || null;
}

// ── POST /api/sync/push ───────────────────────────────────────────────────────
// Headers the Electron app must send:
//   X-Device-Id: <device fingerprint>
//   X-License-Key: <the key>
router.post('/push', requireAuth, upload.single('backup'), async (req, res) => {
    const deviceId   = req.headers['x-device-id'];
    const licenseKey = req.headers['x-license-key'];
    if (!deviceId || !licenseKey) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'X-Device-Id and X-License-Key headers required' });
    }
    if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });

    try {
        const activation = await getActivation(req.account.id, deviceId, licenseKey);
        if (!activation) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: 'Device not activated for this license' });
        }

        // Compute checksum
        const fileBuffer = fs.readFileSync(req.file.path);
        const checksum   = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Rename to a permanent path
        const filename = `${activation.id}_${Date.now()}.db`;
        const destPath = path.join(BACKUP_DIR, filename);
        fs.renameSync(req.file.path, destPath);

        // Insert record
        await db.query(
            `INSERT INTO sync_backups (activation_id, file_path, file_size, checksum)
             VALUES ($1,$2,$3,$4)`,
            [activation.id, destPath, req.file.size, checksum]
        );

        // Prune old backups (keep latest MAX_BACKUPS_PER_ACTIVATION)
        const old = await db.query(
            `SELECT id, file_path FROM sync_backups WHERE activation_id=$1
             ORDER BY created_at DESC OFFSET $2`,
            [activation.id, MAX_BACKUPS_PER_ACTIVATION]
        );
        for (const row of old.rows) {
            try { fs.unlinkSync(row.file_path); } catch {}
            await db.query('DELETE FROM sync_backups WHERE id=$1', [row.id]);
        }

        logger.info('Backup pushed', { activationId: activation.id, size: req.file.size });
        res.json({ success: true, checksum });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        logger.error('Sync push error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/sync/pull ────────────────────────────────────────────────────────
router.get('/pull', requireAuth, async (req, res) => {
    const deviceId   = req.headers['x-device-id'];
    const licenseKey = req.headers['x-license-key'];
    if (!deviceId || !licenseKey) {
        return res.status(400).json({ error: 'X-Device-Id and X-License-Key headers required' });
    }

    try {
        const activation = await getActivation(req.account.id, deviceId, licenseKey);
        if (!activation) return res.status(403).json({ error: 'Device not activated for this license' });

        const result = await db.query(
            `SELECT * FROM sync_backups WHERE activation_id=$1 ORDER BY created_at DESC LIMIT 1`,
            [activation.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'No backup found' });

        const backup = result.rows[0];
        if (!fs.existsSync(backup.file_path)) return res.status(404).json({ error: 'Backup file missing on server' });

        res.setHeader('Content-Disposition', 'attachment; filename="backup.db"');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('X-Checksum', backup.checksum);
        fs.createReadStream(backup.file_path).pipe(res);
    } catch (err) {
        logger.error('Sync pull error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/sync/status ──────────────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
    const deviceId   = req.headers['x-device-id'];
    const licenseKey = req.headers['x-license-key'];
    if (!deviceId || !licenseKey) return res.status(400).json({ error: 'Headers required' });

    try {
        const activation = await getActivation(req.account.id, deviceId, licenseKey);
        if (!activation) return res.status(403).json({ error: 'Not activated' });

        const result = await db.query(
            `SELECT created_at, file_size, checksum FROM sync_backups
             WHERE activation_id=$1 ORDER BY created_at DESC LIMIT 1`,
            [activation.id]
        );
        if (!result.rows.length) return res.json({ hasBackup: false });

        const b = result.rows[0];
        res.json({ hasBackup: true, lastBackupAt: b.created_at, fileSize: b.file_size, checksum: b.checksum });
    } catch (err) {
        logger.error('Sync status error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
