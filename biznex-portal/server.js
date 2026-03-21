require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const crypto     = require('crypto');
const http       = require('http');
const jwt        = require('jsonwebtoken');
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
    // Credential columns — safely ignored if already present
    db.run(`ALTER TABLE accounts ADD COLUMN username TEXT`, () => {});
    db.run(`ALTER TABLE accounts ADD COLUMN password_hash TEXT`, () => {});
    db.run(`ALTER TABLE accounts ADD COLUMN credentials_changed INTEGER DEFAULT 0`, () => {});
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

/* ── Credential helpers ───────────────────────────────────────────────────── */
function generateUsername(name) {
    const base   = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').slice(0, 14) || 'user';
    const suffix = crypto.randomBytes(3).toString('hex'); // 6 hex chars ≈ 16.7M combinations
    return `${base}.${suffix}`;
}

function generatePassword() {
    // 14 chars — no ambiguous chars (0/O, 1/l/I)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%!';
    return Array.from(crypto.randomBytes(14)).map(b => chars[b % chars.length]).join('');
}

function hashPassword(plaintext) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/** Returns a cryptographically random 6-digit OTP not currently active in the store. */
function generateUniqueOtp() {
    const active = new Set([...otpStore.values()].map(e => e.code));
    let code; let attempts = 0;
    do {
        code = String(crypto.randomInt(100000, 1000000));
        attempts++;
    } while (active.has(code) && attempts < 20);
    return code;
}

/* ── BOS License Server sync ─────────────────────────────────────────────── */
async function syncKeyToBOS(key, plan, customerName, customerEmail) {
    const baseUrl     = process.env.LICENSE_SERVER_URL    || 'http://localhost:4000';
    const adminSecret = process.env.LICENSE_ADMIN_SECRET  || 'biznex-admin-2026';
    const payload     = JSON.stringify({ key, plan, customerName, customerEmail, adminSecret });
    console.log(`[bos-sync] Syncing key=${key} to ${baseUrl}`);
    return new Promise((resolve) => {
        try {
            const url = new URL('/api/admin/generate-key', baseUrl);
            const opts = {
                hostname: url.hostname,
                port:     url.port || (url.protocol === 'https:' ? 443 : 80),
                path:     url.pathname,
                method:   'POST',
                headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
                timeout:  5000,
            };
            const req = http.request(opts, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => { 
                    try { 
                        const p = JSON.parse(body);
                        console.log(`[bos-sync] ✅ key=${key} status=${res.statusCode} plan=${p.plan}${p.alreadyExisted ? ' (existed)' : ''}`); 
                    } catch (e) {
                        console.log(`[bos-sync] response status=${res.statusCode} body=${body}`);
                    } 
                    resolve(res.statusCode); 
                });
            });
            req.on('timeout', () => { req.destroy(); console.warn('[bos-sync] ⏱ timeout'); resolve(null); });
            req.on('error',   (e) => { console.warn('[bos-sync] ❌ error:', e.message); resolve(null); });
            req.write(payload);
            req.end();
        } catch (e) { console.warn('[bos-sync] ❌ failed:', e.message); resolve(null); }
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

async function sendKeyEmail(to, name, key, plan, credentials = null) {
    const t = makeTransporter();
    if (!t) return false;
    const meta = PLAN_MAP[plan] || PLAN_MAP.starter;
    const credBlock = credentials ? `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin-top:20px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Your Portal Login Credentials</div>
            <div style="margin-bottom:10px;"><div style="font-size:11px;color:#94a3b8;">Username</div><div style="font-family:monospace;font-size:16px;font-weight:700;color:#a5b4fc;">${credentials.username}</div></div>
            <div><div style="font-size:11px;color:#94a3b8;">Password</div><div style="font-family:monospace;font-size:16px;font-weight:700;color:#a5b4fc;">${credentials.password}</div></div>
            <p style="font-size:11px;color:#64748b;margin-top:12px;line-height:1.5;">You can change these once (no code needed) from your dashboard. After that, changes require email verification.</p>
        </div>` : '';
    await t.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER, to,
        subject: `Your Biznex ${meta.label} License Key`,
        html: `<div style="font-family:Arial;max-width:560px;background:#0d1526;color:#e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background:#4f46e5;padding:24px 32px;"><h2 style="margin:0;color:#fff;">Biznex BOS</h2></div>
            <div style="padding:32px;"><p>Hi <b>${name}</b>,</p><p>Your license key:</p>
            <div style="background:#1e293b;border-radius:10px;padding:20px;text-align:center;font-family:monospace;font-size:22px;font-weight:700;letter-spacing:3px;color:#a5b4fc;">${key}</div>
            <p style="font-size:13px;color:#94a3b8;">Plan: <b>${meta.label}</b> · Max devices: <b>${meta.maxDevices >= 999999 ? 'Unlimited' : meta.maxDevices}</b></p>
            ${credBlock}</div></div>`,
    });
    return true;
}

async function sendCredentialsEmail(to, name, username, plainPassword) {
    const t = makeTransporter();
    if (!t) return false;
    await t.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER, to,
        subject: 'Biznex Portal — Your Credentials Have Been Updated',
        html: `<div style="font-family:Arial;max-width:520px;background:#0d1526;color:#e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background:#4f46e5;padding:20px 28px;"><h2 style="margin:0;color:#fff;">Biznex Portal</h2></div>
            <div style="padding:28px;">
                <p>Hi <b>${name}</b>, your portal login credentials have been updated.</p>
                <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin:16px 0;">
                    <div style="margin-bottom:10px;"><div style="font-size:11px;color:#94a3b8;">Username</div><div style="font-family:monospace;font-size:16px;font-weight:700;color:#a5b4fc;">${username}</div></div>
                    <div><div style="font-size:11px;color:#94a3b8;">Password</div><div style="font-family:monospace;font-size:16px;font-weight:700;color:#a5b4fc;">${plainPassword}</div></div>
                </div>
                <p style="font-size:12px;color:#64748b;">If you did not make this change, please contact support immediately.</p>
            </div></div>`,
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

// Rate limiting (increased for development/testing)
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true });
const otpLimiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 100,  standardHeaders: true,
    message: { error: 'Too many requests. Please wait 15 minutes before trying again.' } });
const loginLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 100,  standardHeaders: true,
    message: { error: 'Too many login attempts. Please wait 15 minutes.' } });

app.use(generalLimiter);

/* ── API routes ───────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════════════════
// SIGNUP — Simple: email + password directly (no OTP)
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/signup', async (req, res) => {
    const { email, password, plan = 'starter' } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!PLAN_MAP[plan]) return res.status(400).json({ error: 'Invalid plan.' });

    // Check if email already exists
    const existing = await dbGet('SELECT id FROM accounts WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
        return res.status(400).json({ error: 'Email already registered.' });
    }

    try {
        // Create the account
        const result = await dbRun('INSERT INTO accounts (name, email) VALUES (?, ?)', 
            [email.toLowerCase(), email.toLowerCase()]);
        const acctId = result.lastID;

        // Hash and set password
        const pwdHash = hashPassword(password);
        await dbRun('UPDATE accounts SET password_hash = ? WHERE id = ?', [pwdHash, acctId]);

        // Generate login credentials
        const username = generateUsername(email);
        const appPassword = generatePassword();
        const appPwdHash = hashPassword(appPassword);
        await dbRun('UPDATE accounts SET username = ?, password_hash = ?, credentials_changed = 1 WHERE id = ?', 
            [username, appPwdHash, acctId]);

        // Generate license key
        const key = generateKey(plan);
        const meta = PLAN_MAP[plan];
        await dbRun('INSERT INTO license_keys (account_id, key, plan, max_devices) VALUES (?, ?, ?, ?)',
            [acctId, key, plan, meta.maxDevices >= 999999 ? 999999 : meta.maxDevices]);

        // Get full account details
        const account = await dbGet('SELECT * FROM accounts WHERE id = ?', [acctId]);

        // Sync key to BOS (wait for it to complete)
        const syncStatus = await syncKeyToBOS(key, plan, email, email);
        console.log(`[signup] Key synced to BOS with status: ${syncStatus}`);

        // Get plan features
        const planFeatures = {
            'starter': {
                max_locations: 1,
                cloud_sync: true,
                auto_updates: true,
                multi_store: false,
                priority_support: false,
                advanced_reports: false,
                custom_branding: false,
                api_access: false,
            },
            'business': {
                max_locations: 10,
                cloud_sync: true,
                auto_updates: true,
                multi_store: true,
                priority_support: true,
                advanced_reports: true,
                custom_branding: false,
                api_access: false,
            },
            'enterprise': {
                max_locations: 'Unlimited',
                cloud_sync: true,
                auto_updates: true,
                multi_store: true,
                priority_support: true,
                advanced_reports: true,
                custom_branding: true,
                api_access: true,
            },
        };

        res.json({ 
            success: true,
            account: {
                id: account.id,
                email: account.email,
                username: username,
            },
            credentials: {
                username: username,
                password: appPassword,
                note: 'Save these credentials - they are needed to access your app'
            },
            license: {
                key, 
                plan, 
                planType: meta.planType, 
                maxDevices: meta.maxDevices,
            },
            features: planFeatures[plan],
            message: 'Account created successfully!'
        });
    } catch (err) {
        console.error('Account creation error:', err);
        res.status(500).json({ error: 'Failed to create account.' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// LOGIN — email + password 
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const account = await dbGet('SELECT * FROM accounts WHERE email = ?', [email.toLowerCase()]);
    if (!account) return res.status(404).json({ error: 'Email not found.' });
    if (!account.password_hash) return res.status(400).json({ error: 'Password not set for this account.' });

    // Verify password
    const [salt, hash] = account.password_hash.split(':');
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    if (testHash !== hash) {
        return res.status(401).json({ error: 'Incorrect password.' });
    }

    const keys   = await dbAll('SELECT * FROM license_keys WHERE account_id = ?', [account.id]);
    const stores = await dbAll('SELECT * FROM stores WHERE account_id = ?', [account.id]);
    res.json({ success: true, account, keys, stores });
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

// UPGRADE PLAN — Step 1: send OTP to verify identity; Step 2: verify + generate new key
app.post('/api/upgrade-plan', otpLimiter, async (req, res) => {
    const { email, code, newPlan } = req.body;
    if (!email)                      return res.status(400).json({ error: 'Email is required.' });
    if (!newPlan || !PLAN_MAP[newPlan]) return res.status(400).json({ error: 'Invalid plan.' });

    const account = await dbGet('SELECT id, name FROM accounts WHERE email = ?', [email.toLowerCase()]);
    if (!account) return res.status(404).json({ error: 'No account found for that email.' });

    // Step 2: verify OTP and generate the new key
    if (code) {
        const entry = otpStore.get(email.toLowerCase() + ':upgrade');
        if (!entry) return res.status(400).json({ error: 'No upgrade request found. Please request a new code.' });
        if (Date.now() > entry.expires) {
            otpStore.delete(email.toLowerCase() + ':upgrade');
            return res.status(400).json({ error: 'Code expired. Please request a new one.' });
        }
        if (String(entry.code) !== String(code).trim())
            return res.status(400).json({ error: 'Incorrect code. Please try again.' });
        if (entry.newPlan !== newPlan)
            return res.status(400).json({ error: 'Plan mismatch. Please start the upgrade again.' });

        otpStore.delete(email.toLowerCase() + ':upgrade');

        const key  = generateKey(newPlan);
        const meta = PLAN_MAP[newPlan];
        await dbRun('INSERT INTO license_keys (account_id, key, plan, max_devices) VALUES (?, ?, ?, ?)',
            [account.id, key, newPlan, meta.maxDevices >= 999999 ? 999999 : meta.maxDevices]);

        let emailSent = false;
        try { emailSent = await sendKeyEmail(email, account.name, key, newPlan); } catch {}
        syncKeyToBOS(key, newPlan, account.name, email).catch(() => {});

        return res.json({
            success: true, key, plan: newPlan, planLabel: meta.label,
            maxDevices: meta.maxDevices, emailSent,
            emailNote: emailSent ? null : 'Configure SMTP in .env to enable email delivery.',
        });
    }

    // Step 1: send OTP
    const upgradeCode = generateUniqueOtp();
    const expires     = Date.now() + 10 * 60 * 1000;
    otpStore.set(email.toLowerCase() + ':upgrade', { code: upgradeCode, expires, newPlan });

    let sent = false;
    try { sent = await sendVerificationEmail(email, account.name, upgradeCode); } catch (e) {
        console.error('Upgrade OTP email error:', e.message);
    }
    res.json({
        requiresCode: true, sent,
        devCode: (sent || process.env.NODE_ENV === 'production') ? undefined : upgradeCode,
        message: sent
            ? `Verification code sent to ${email}. Enter it to confirm the upgrade.`
            : 'SMTP not configured — use this code to continue:',
    });
});

// CHANGE CREDENTIALS
// • No newPassword + credentials_changed=1  → send OTP (step 1)
// • newPassword + credentials_changed=0     → free one-time change (no OTP needed)
// • newPassword + credentials_changed=1 + code → verify OTP, then change
app.post('/api/change-credentials', otpLimiter, async (req, res) => {
    const { email, newUsername, newPassword, code } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const account = await dbGet('SELECT * FROM accounts WHERE email = ?', [email.toLowerCase()]);
    if (!account) return res.status(404).json({ error: 'Account not found.' });

    // Step 1 for verified accounts: just send OTP (caller provides no newPassword yet)
    if (account.credentials_changed && !code && !newPassword) {
        const otpCode = generateUniqueOtp();
        const expires = Date.now() + 10 * 60 * 1000;
        otpStore.set(email.toLowerCase() + ':credchange', { code: otpCode, expires });

        let sent = false;
        try { sent = await sendVerificationEmail(email, account.name, otpCode); } catch (e) {
            console.error('Credential-change OTP error:', e.message);
        }
        return res.json({
            requiresCode: true, sent,
            devCode: (sent || process.env.NODE_ENV === 'production') ? undefined : otpCode,
            message: sent
                ? `Verification code sent to ${email}.`
                : 'SMTP not configured — use this code to continue:',
        });
    }

    if (!newPassword) return res.status(400).json({ error: 'New password is required.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    // Validate new username if provided
    if (newUsername) {
        if (!/^[a-zA-Z0-9._-]{3,30}$/.test(newUsername))
            return res.status(400).json({ error: 'Username may only contain letters, numbers, dots, dashes, underscores (3–30 chars).' });
        const taken = await dbGet('SELECT id FROM accounts WHERE username = ? AND id != ?', [newUsername, account.id]);
        if (taken) return res.status(409).json({ error: 'That username is already taken. Please choose another.' });
    }

    const finalUsername = newUsername || account.username;
    const pwdHash       = hashPassword(newPassword);

    // Free first-time change — no OTP (user just verified email during registration / login)
    if (!account.credentials_changed) {
        await dbRun('UPDATE accounts SET username = ?, password_hash = ?, credentials_changed = 1 WHERE id = ?',
            [finalUsername, pwdHash, account.id]);
        try { await sendCredentialsEmail(email, account.name, finalUsername, newPassword); } catch {}
        return res.json({ success: true, username: finalUsername });
    }

    // OTP-verified change
    if (!code) return res.status(400).json({ error: 'Verification code is required.' });
    const entry = otpStore.get(email.toLowerCase() + ':credchange');
    if (!entry) return res.status(400).json({ error: 'No pending verification. Please request a new code.' });
    if (Date.now() > entry.expires) {
        otpStore.delete(email.toLowerCase() + ':credchange');
        return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }
    if (String(entry.code) !== String(code).trim())
        return res.status(400).json({ error: 'Incorrect code. Please try again.' });

    otpStore.delete(email.toLowerCase() + ':credchange');
    await dbRun('UPDATE accounts SET username = ?, password_hash = ? WHERE id = ?',
        [finalUsername, pwdHash, account.id]);
    try { await sendCredentialsEmail(email, account.name, finalUsername, newPassword); } catch {}
    return res.json({ success: true, username: finalUsername });
});

// ════════════════════════════════════════════════════════════════════════════
// CLEANUP ROUTINE — Periodically remove expired OTPs from memory
// ════════════════════════════════════════════════════════════════════════════

setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of otpStore.entries()) {
        if (entry.expires && now > entry.expires) {
            otpStore.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`[portal] Cleaned up ${cleaned} expired OTP entries`);
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// ════════════════════════════════════════════════════════════════════════════
// LICENSE ACTIVATION — Validate license key from app
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/license/activate', express.json(), async (req, res) => {
    const { key, device_id, device_name } = req.body;
    if (!key) return res.status(400).json({ success: false, error: 'License key is required.' });

    try {
        // Validate key format: BZNX-{PLAN}-{8 HEX}-{8 HEX}
        const match = key.match(/^BZNX-(STR|BIZ|ENT)-([A-F0-9]{8})-([A-F0-9]{8})$/i);
        if (!match) {
            return res.status(400).json({ success: false, error: 'Invalid key format.' });
        }

        const planCode = match[1].toUpperCase();
        const planMap = { 'STR': 'starter', 'BIZ': 'business', 'ENT': 'enterprise' };
        const plan = planMap[planCode];

        // Look up the license key in the database
        const license = await dbGet('SELECT * FROM license_keys WHERE key = ?', [key]);
        if (!license) {
            return res.status(404).json({ success: false, error: 'License key not found or invalid.' });
        }

        // License is valid — generate a JWT token for offline validation
        const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
        const licenseToken = jwt.sign(
            {
                key: license.key,
                plan: license.plan,
                maxSeats: license.max_devices || 1,
                accountId: license.account_id,
                issuedAt: Date.now(),
            },
            JWT_SECRET,
            { expiresIn: '365d' }
        );

        const meta = PLAN_MAP[plan] || PLAN_MAP.starter;

        res.json({
            success: true,
            licenseToken,
            plan,
            planLabel: plan === 'starter' ? 'Starter' : plan === 'business' ? 'Business' : 'Enterprise',
            maxDevices: meta.maxDevices,
            message: 'License activated successfully!',
        });
    } catch (err) {
        console.error('License activation error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
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

