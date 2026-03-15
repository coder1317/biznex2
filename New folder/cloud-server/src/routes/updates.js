const router = require('express').Router();
const db     = require('../db');
const logger = require('../logger');
const { requireAdmin } = require('../middleware/auth');

// ── GET /api/updates/latest?platform=win32&arch=x64&version=1.0.0 ─────────────
// Called by the Electron app on startup to check for newer builds.
router.get('/latest', async (req, res) => {
    const { platform = 'win32', arch = 'x64', version } = req.query;

    try {
        const result = await db.query(
            `SELECT * FROM releases
             WHERE platform=$1 AND arch=$2 AND is_stable=TRUE
             ORDER BY created_at DESC LIMIT 1`,
            [platform, arch]
        );

        if (!result.rows.length) return res.json({ updateAvailable: false });

        const latest = result.rows[0];

        // Compare: if the client version matches or is newer, no update needed
        if (version && semverGte(version, latest.version)) {
            return res.json({ updateAvailable: false, currentVersion: latest.version });
        }

        res.json({
            updateAvailable: true,
            version:         latest.version,
            downloadUrl:     latest.download_url,
            releaseNotes:    latest.release_notes,
            releasedAt:      latest.created_at,
        });
    } catch (err) {
        logger.error('Updates latest error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/updates/all (admin) ──────────────────────────────────────────────
router.get('/all', requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM releases ORDER BY created_at DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ── POST /api/updates/release (admin) ────────────────────────────────────────
router.post('/release', requireAdmin, async (req, res) => {
    const { version, platform, arch = 'x64', download_url, release_notes, is_stable = true } = req.body;
    if (!version || !platform || !download_url) {
        return res.status(400).json({ error: 'version, platform, download_url required' });
    }
    try {
        const result = await db.query(
            `INSERT INTO releases (version,platform,arch,download_url,release_notes,is_stable)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [version, platform, arch, download_url, release_notes, is_stable]
        );
        logger.info('Release published', { version, platform, arch });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Version already exists for this platform' });
        logger.error('Publish release error', { err });
        res.status(500).json({ error: 'Server error' });
    }
});

// ── minimal semver gte comparison ─────────────────────────────────────────────
function semverGte(a, b) {
    const parse = (s) => (s || '0.0.0').split('.').map(Number);
    const [aMaj, aMin, aPat] = parse(a);
    const [bMaj, bMin, bPat] = parse(b);
    if (aMaj !== bMaj) return aMaj > bMaj;
    if (aMin !== bMin) return aMin > bMin;
    return aPat >= bPat;
}

module.exports = router;
