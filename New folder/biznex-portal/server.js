require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const crypto     = require('crypto');
const http       = require('http');
const nodemailer = require('nodemailer');
const sqlite3    = require('sqlite3').verbose();

const app  = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'portal.db');

// ── SQLite database ─────────────────────────────────────────────────────────
const db = new sqlite3.Database(DB_PATH);
const dbRun = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
const dbGet = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const dbAll = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));

db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL');
    db.run(`CREATE TABLE IF NOT EXISTS accounts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS license_keys (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id  INTEGER NOT NULL REFERENCES accounts(id),
        key         TEXT UNIQUE NOT NULL,
        plan        TEXT NOT NULL DEFAULT 'starter',
        max_devices INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS stores (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        name       TEXT NOT NULL,
        location   TEXT DEFAULT '',
        type       TEXT DEFAULT 'retail',
        active     INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run('SELECT 1', () => console.log('[portal] SQLite schema ready'));
});

// In-memory OTP store (clears on restart — acceptable for stateless OTP flow)
const otpStore = new Map(); // key: email → { code, expires, name?, plan? }

/* ── Plan config ──────────────────────────────────────────────────────────── */
const PLAN_MAP = {
    starter:    { prefix: 'STR', maxDevices: 1,      label: 'Starter',    planType: 'Single Store' },
    business:   { prefix: 'BIZ', maxDevices: 10,     label: 'Business',   planType: 'Multi-Store' },
    enterprise: { prefix: 'ENT', maxDevices: 999999, label: 'Enterprise', planType: 'Unlimited' },
};

function generateKey(plan) {
    const p = PLAN_MAP[plan]?.prefix || 'STR';
    const a = crypto.randomBytes(4).toString('hex').toUpperCase();
    const b = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `BZNX-${p}-${a}-${b}`;
}

/* ── BOS License Server sync ─────────────────────────────────────────────── */
async function syncKeyToBOS(key, plan, customerName, customerEmail) {
    const baseUrl     = process.env.LICENSE_SERVER_URL    || 'http://localhost:4000';
    const adminSecret = process.env.LICENSE_ADMIN_SECRET  || 'biznex-admin-2026';
    const payload     = JSON.stringify({ key, plan, customerName, customerEmail, adminSecret });
    return new Promise((resolve) => {
        try {
            const url = new URL('/api/admin/generate-key', baseUrl);
            const opts = {
                hostname: url.hostname,
                port:     url.port || (url.protocol === 'https:' ? 443 : 80),
                path:     url.pathname,
                method:   'POST',
                headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
                timeout:  3000,
            };
            const req = http.request(opts, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => { try { const p = JSON.parse(body); console.log(`[bos-sync] key=${key} status=${res.statusCode}${p.alreadyExisted ? ' (existed)' : ''}`); } catch {} resolve(res.statusCode); });
            });
            req.on('timeout', () => { req.destroy(); console.warn('[bos-sync] timeout'); resolve(null); });
            req.on('error',   () => { console.warn('[bos-sync] error — BOS server unreachable'); resolve(null); });
            req.write(payload);
            req.end();
        } catch (e) { console.warn('[bos-sync] failed:', e.message); resolve(null); }
    });
}

/* ── Email helpers ────────────────────────────────────────────────────────── */
function makeTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
    return nodemailer.createTransport({
        host: SMTP_HOST, port: Number(SMTP_PORT) || 587, secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
}

async function sendVerificationEmail(to, name, code) {
    const t = makeTransporter();
    if (!t) return false;
    await t.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER, to,
        subject: 'Biznex Portal — Verification Code',
        html: `<div style="font-family:Arial;max-width:520px;background:#0d1526;color:#e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background:#4f46e5;padding:20px 28px;"><h2 style="margin:0;color:#fff;">Biznex Portal</h2></div>
            <div style="padding:28px;">
                <p>Hi <b>${name || 'there'}</b>, enter this code to continue.</p>
                <div style="background:#1e293b;border:2px solid #4f46e5;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
                    <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#a5b4fc;font-family:monospace;">${code}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:8px;">Valid for 10 minutes</div>
                </div>
                <p style="font-size:12px;color:#64748b;">If you did not request this, ignore this email.</p>
            </div></div>`,
    });
    return true;
}

async function sendKeyEmail(to, name, key, plan) {
    const t = makeTransporter();
    if (!t) return false;
    const meta = PLAN_MAP[plan] || PLAN_MAP.starter;
    await t.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER, to,
        subject: `Your Biznex ${meta.label} License Key`,
        html: `<div style="font-family:Arial;max-width:560px;background:#0d1526;color:#e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background:#4f46e5;padding:24px 32px;"><h2 style="margin:0;color:#fff;">Biznex BOS</h2></div>
            <div style="padding:32px;"><p>Hi <b>${name}</b>,</p><p>Your license key:</p>
            <div style="background:#1e293b;border-radius:10px;padding:20px;text-align:center;font-family:monospace;font-size:22px;font-weight:700;letter-spacing:3px;color:#a5b4fc;">${key}</div>
            <p style="font-size:13px;color:#94a3b8;">Plan: <b>${meta.label}</b> · Max devices: <b>${meta.maxDevices >= 999999 ? 'Unlimited' : meta.maxDevices}</b></p></div></div>`,
    });
    return true;
}

/* ── Admin secret check ───────────────────────────────────────────────────── */
function checkAdmin(req, res) {
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    if (!ADMIN_SECRET) {
        console.error('[portal] ADMIN_SECRET not set in .env — admin routes are locked');
        res.status(503).json({ error: 'Admin not configured.' });
        return false;
    }
    const secret = req.query.adminSecret || req.body?.adminSecret;
    if (secret !== ADMIN_SECRET) {
        res.status(403).json({ error: 'Invalid admin secret.' });
        return false;
    }
    return true;
}

/* ── Middleware ───────────────────────────────────────────────────────────── */
app.use(helmet({ contentSecurityPolicy: false })); // CSP handled by index.html meta
app.use(cors({ origin: process.env.PORTAL_ORIGIN || true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true });
const otpLimiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  standardHeaders: true,
    message: { error: 'Too many requests. Please wait 15 minutes before trying again.' } });
const loginLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  standardHeaders: true,
    message: { error: 'Too many login attempts. Please wait 15 minutes.' } });

app.use(generalLimiter);

/* ── API routes ───────────────────────────────────────────────────────────── */

// STEP 1 — Send verification code (for new registrations)
app.post('/api/send-verification', otpLimiter, async (req, res) => {
    const { name, email, plan = 'starter' } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
    if (!PLAN_MAP[plan])  return res.status(400).json({ error: 'Invalid plan.' });

    const code    = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    otpStore.set(email.toLowerCase(), { code, expires, name, plan });

    let sent = false;
    try { sent = await sendVerificationEmail(email, name, code); } catch (e) {
        console.error('OTP email error:', e.message);
    }

    res.json({
        sent,
        // Only expose devCode when SMTP is not configured (development mode)
        devCode: (sent || process.env.NODE_ENV === 'production') ? undefined : code,
        message: sent
            ? `Verification code sent to ${email}. Check your inbox.`
            : 'SMTP not configured — use this code to continue:',
    });
});

// STEP 2 — Verify code & create account + key
app.post('/api/verify-code', otpLimiter, async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });

    const entry = otpStore.get(email.toLowerCase());
    if (!entry)               return res.status(400).json({ error: 'No verification request found. Please request a new code.' });
    if (Date.now() > entry.expires) {
        otpStore.delete(email.toLowerCase());
        return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }
    if (String(entry.code) !== String(code).trim()) {
        return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    otpStore.delete(email.toLowerCase());
    const { name, plan } = entry;

    const existing = await dbGet('SELECT id FROM accounts WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
        const k = await dbGet('SELECT * FROM license_keys WHERE account_id = ? LIMIT 1', [existing.id]);
        return res.status(409).json({ error: 'Email already registered.', key: k || null });
    }

    const result  = await dbRun('INSERT INTO accounts (name, email) VALUES (?, ?)', [name, email.toLowerCase()]);
    const acctId  = result.lastID;
    const key     = generateKey(plan);
    const meta    = PLAN_MAP[plan];
    await dbRun('INSERT INTO license_keys (account_id, key, plan, max_devices) VALUES (?, ?, ?, ?)',
        [acctId, key, plan, meta.maxDevices >= 999999 ? 999999 : meta.maxDevices]);

    const account = await dbGet('SELECT * FROM accounts WHERE id = ?', [acctId]);
    let emailSent = false;
    try { emailSent = await sendKeyEmail(email, name, key, plan); } catch {}
    syncKeyToBOS(key, plan, name, email).catch(() => {});

    res.json({ account, key, plan, planType: meta.planType, maxDevices: meta.maxDevices, emailSent,
        emailNote: emailSent ? null : 'Configure SMTP in .env to enable email delivery.' });
});

// LOGIN — Step 1: send OTP to email
app.post('/api/login', loginLimiter, async (req, res) => {
    const { email, code } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Step 2: if code provided, verify it and return account/keys
    if (code) {
        const entry = otpStore.get(email.toLowerCase() + ':login');
        if (!entry)               return res.status(400).json({ error: 'No login request found. Please request a new code.' });
        if (Date.now() > entry.expires) {
            otpStore.delete(email.toLowerCase() + ':login');
            return res.status(400).json({ error: 'Code expired. Please request a new one.' });
        }
        if (String(entry.code) !== String(code).trim()) {
            return res.status(400).json({ error: 'Incorrect code. Please try again.' });
        }
        otpStore.delete(email.toLowerCase() + ':login');

        const account = await dbGet('SELECT * FROM accounts WHERE email = ?', [email.toLowerCase()]);
        if (!account) return res.status(404).json({ error: 'Account not found.' });

        const keys   = await dbAll('SELECT * FROM license_keys WHERE account_id = ?', [account.id]);
        const stores = await dbAll('SELECT * FROM stores WHERE account_id = ?', [account.id]);
        return res.json({ account, keys, stores });
    }

    // Step 1: account must exist, then send OTP
    const account = await dbGet('SELECT id, name FROM accounts WHERE email = ?', [email.toLowerCase()]);
    if (!account) return res.status(404).json({ error: 'No account found for that email.' });

    const loginCode = String(Math.floor(100000 + Math.random() * 900000));
    const expires   = Date.now() + 10 * 60 * 1000;
    otpStore.set(email.toLowerCase() + ':login', { code: loginCode, expires });

    let sent = false;
    try { sent = await sendVerificationEmail(email, account.name, loginCode); } catch (e) {
        console.error('Login OTP email error:', e.message);
    }

    res.json({
        sent,
        requiresCode: true,
        devCode: (sent || process.env.NODE_ENV === 'production') ? undefined : loginCode,
        message: sent
            ? `Verification code sent to ${email}. Check your inbox.`
            : 'SMTP not configured — use this code to continue:',
    });
});

app.get('/api/account/:email', async (req, res) => {
    const account = await dbGet('SELECT * FROM accounts WHERE email = ?', [req.params.email.toLowerCase()]);
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    const keys   = await dbAll('SELECT * FROM license_keys WHERE account_id = ?', [account.id]);
    const stores = await dbAll('SELECT * FROM stores WHERE account_id = ?', [account.id]);
    res.json({ account, keys, stores });
});

app.get('/api/stores/:accountId', async (req, res) => {
    const stores = await dbAll('SELECT * FROM stores WHERE account_id = ?', [Number(req.params.accountId)]);
    res.json(stores);
});

app.post('/api/stores', async (req, res) => {
    const { accountId, name, location = '', type = 'retail' } = req.body;
    if (!accountId || !name) return res.status(400).json({ error: 'accountId and name required.' });

    const account = await dbGet('SELECT id FROM accounts WHERE id = ?', [Number(accountId)]);
    if (!account) return res.status(404).json({ error: 'Account not found.' });

    const keyRec = await dbGet('SELECT plan FROM license_keys WHERE account_id = ? LIMIT 1', [account.id]);
    const plan   = keyRec?.plan || 'starter';
    const maxStores = plan === 'enterprise' ? Infinity : plan === 'business' ? 10 : 1;
    const current   = (await dbGet('SELECT COUNT(*) AS c FROM stores WHERE account_id = ?', [account.id]))?.c || 0;

    if (current >= maxStores) {
        const meta = PLAN_MAP[plan];
        return res.status(403).json({ error: `${meta.label} plan allows up to ${maxStores} store(s). Upgrade to add more.`, planLimit: true });
    }

    const r = await dbRun('INSERT INTO stores (account_id, name, location, type) VALUES (?, ?, ?, ?)',
        [Number(accountId), name, location, type]);
    const store = await dbGet('SELECT * FROM stores WHERE id = ?', [r.lastID]);
    res.json(store);
});

app.put('/api/stores/:id', async (req, res) => {
    const store = await dbGet('SELECT * FROM stores WHERE id = ?', [Number(req.params.id)]);
    if (!store) return res.status(404).json({ error: 'Store not found.' });
    const { name, location, type, active } = req.body;
    await dbRun('UPDATE stores SET name=COALESCE(?,name), location=COALESCE(?,location), type=COALESCE(?,type), active=COALESCE(?,active) WHERE id=?',
        [name ?? null, location ?? null, type ?? null, active !== undefined ? Number(active) : null, store.id]);
    const updated = await dbGet('SELECT * FROM stores WHERE id = ?', [store.id]);
    res.json(updated);
});

app.delete('/api/stores/:id', async (req, res) => {
    const r = await dbRun('DELETE FROM stores WHERE id = ?', [Number(req.params.id)]);
    if (r.changes === 0) return res.status(404).json({ error: 'Store not found.' });
    res.json({ ok: true });
});

// Store metrics endpoint — returns real aggregated data (no mock)
app.get('/api/stores/:id/metrics', async (req, res) => {
    const store = await dbGet('SELECT * FROM stores WHERE id = ?', [Number(req.params.id)]);
    if (!store) return res.status(404).json({ error: 'Store not found.' });
    // Real metrics will be populated once store sync is implemented.
    // Returns an empty structure so the UI can handle the not-yet-synced case.
    res.json({
        store,
        metrics: {
            note: 'Store metrics will be available once the store syncs data to the cloud.',
            available: false,
        },
    });
});

/* ── Admin routes ─────────────────────────────────────────────────────────── */
app.get('/api/admin/accounts', async (req, res) => {
    if (!checkAdmin(req, res)) return;
    const accounts = await dbAll('SELECT * FROM accounts ORDER BY created_at DESC');
    const out = await Promise.all(accounts.map(async (a) => {
        const k = await dbGet('SELECT plan, key FROM license_keys WHERE account_id = ? LIMIT 1', [a.id]);
        const storeCount = (await dbGet('SELECT COUNT(*) AS c FROM stores WHERE account_id = ?', [a.id]))?.c || 0;
        return { ...a, plan: k?.plan || null, key: k?.key || null, store_count: storeCount };
    }));
    res.json({ accounts: out });
});

app.post('/api/admin/generate-key', async (req, res) => {
    if (!checkAdmin(req, res)) return;
    const { email, name = 'Customer', plan = 'starter' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    if (!PLAN_MAP[plan]) return res.status(400).json({ error: 'Invalid plan.' });

    let account = await dbGet('SELECT * FROM accounts WHERE email = ?', [email.toLowerCase()]);
    if (!account) {
        const r = await dbRun('INSERT INTO accounts (name, email) VALUES (?, ?)', [name, email.toLowerCase()]);
        account = await dbGet('SELECT * FROM accounts WHERE id = ?', [r.lastID]);
    }

    const key  = generateKey(plan);
    const meta = PLAN_MAP[plan];
    await dbRun('INSERT INTO license_keys (account_id, key, plan, max_devices) VALUES (?, ?, ?, ?)',
        [account.id, key, plan, meta.maxDevices >= 999999 ? 999999 : meta.maxDevices]);

    let emailSent = false;
    try { emailSent = await sendKeyEmail(email, name, key, plan); } catch {}
    syncKeyToBOS(key, plan, name, email).catch(() => {});
    res.json({ key, plan, emailSent, account });
});

app.post('/api/admin/revoke-key', async (req, res) => {
    if (!checkAdmin(req, res)) return;
    const { key } = req.body;
    const r = await dbRun('DELETE FROM license_keys WHERE key = ?', [key]);
    if (r.changes === 0) return res.status(404).json({ error: 'Key not found.' });
    res.json({ ok: true });
});

app.post('/api/admin/sync-to-bos', async (req, res) => {
    if (!checkAdmin(req, res)) return;
    const keys = await dbAll(`
        SELECT lk.key, lk.plan, a.name, a.email
        FROM license_keys lk
        JOIN accounts a ON lk.account_id = a.id`);
    const results = [];
    for (const k of keys) {
        const status = await syncKeyToBOS(k.key, k.plan, k.name, k.email);
        results.push({ key: k.key, plan: k.plan, status });
    }
    res.json({ synced: results.length, results });
});

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
    console.log(`\n  Biznex Portal running at http://localhost:${PORT}`);
    if (!process.env.ADMIN_SECRET) {
        console.warn('  ⚠️  ADMIN_SECRET is not set in .env — admin routes are disabled');
    }
    if (!process.env.SMTP_HOST) {
        console.warn('  ⚠️  SMTP not configured — OTP codes will appear in API responses (dev mode)');
    }
});

