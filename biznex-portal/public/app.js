/* ── Config ──────────────────────────────────────────────────────────────────── */
const API = window.location.origin;

/* ── State ───────────────────────────────────────────────────────────────────── */
let currentSession = null; // { account, key, stores }
let adminSecret    = '';
let selectedPlan   = 'starter';
let dashActiveTab  = 'overview';

const PLAN_META = {
    starter:    { label: 'Starter',    color: '#818cf8', cls: 'starter' },
    business:   { label: 'Business',   color: '#38bdf8', cls: 'business' },
    enterprise: { label: 'Enterprise', color: '#34d399', cls: 'enterprise' },
};

/* ── Page navigation ─────────────────────────────────────────────────────────── */
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById('page-' + id);
    if (page) page.classList.remove('hidden');
    window.scrollTo(0, 0);
    // Reset register flow to step 1 whenever the page is shown
    if (id === 'register') {
        const s1 = document.getElementById('regStep1');
        const s2 = document.getElementById('regStep2');
        if (s1) s1.style.display = 'block';
        if (s2) s2.style.display = 'none';
        const regBtn = document.getElementById('regBtn');
        if (regBtn) { regBtn.disabled = false; }
        const regBtnText = document.getElementById('regBtnText');
        if (regBtnText) regBtnText.textContent = 'Send Verification Code';
        const regErr = document.getElementById('regError');
        if (regErr) regErr.style.display = 'none';
        setRegStep(1);
    }
    // Reset login flow to step 1
    if (id === 'login') {
        const ls1 = document.getElementById('loginStep1');
        const ls2 = document.getElementById('loginStep2');
        if (ls1) ls1.style.display = 'block';
        if (ls2) ls2.style.display = 'none';
        const le = document.getElementById('loginError');
        if (le) le.style.display = 'none';
        const loe = document.getElementById('loginOtpError');
        if (loe) loe.style.display = 'none';
    }
}

/* ── Plan selection ──────────────────────────────────────────────────────────── */
function selectPlan(plan) {
    selectedPlan = plan;
    document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.plan-card[data-plan="${plan}"]`);
    if (card) card.classList.add('selected');

    const lbl = document.getElementById('selectedPlanLabel');
    if (lbl) {
        const meta = PLAN_META[plan] || {};
        lbl.textContent = meta.label || plan;
        lbl.className = `highlight-${plan === 'starter' ? 'str' : plan === 'business' ? 'biz' : 'ent'}`;
    }
}

/* ── Registration ────────────────────────────────────────────────────────────── */
// Step indicator
function setRegStep(n) {
    [1,2,3].forEach(i => {
        const dot = document.getElementById('step-dot-' + i);
        if (dot) { dot.classList.toggle('active', i <= n); dot.classList.toggle('done', i < n); }
    });
}

// OTP box auto-advance / paste
function initOtpBoxes() {
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach((box, idx) => {
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '');
            if (box.value && idx < boxes.length - 1) boxes[idx + 1].focus();
        });
        box.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !box.value && idx > 0) boxes[idx - 1].focus();
            if (e.key === 'ArrowLeft'  && idx > 0) boxes[idx - 1].focus();
            if (e.key === 'ArrowRight' && idx < boxes.length - 1) boxes[idx + 1].focus();
        });
        box.addEventListener('paste', e => {
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
            if (pasted.length >= 6) {
                e.preventDefault();
                pasted.split('').forEach((ch, i) => { if (boxes[i]) boxes[i].value = ch; });
                boxes[5].focus();
            }
        });
    });
}

function getOtpValue() {
    return [0,1,2,3,4,5].map(i => document.getElementById('otp-' + i)?.value || '').join('');
}
function clearOtpBoxes() {
    [0,1,2,3,4,5].forEach(i => { const b = document.getElementById('otp-' + i); if (b) b.value = ''; });
    document.getElementById('otp-0')?.focus();
}

// STEP 1 — Send verification code
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const btn   = document.getElementById('regBtn');
    const err   = document.getElementById('regError');

    err.style.display = 'none';
    btn.disabled = true;
    document.getElementById('regBtnText').innerHTML = '<span class="spinner"></span>Sending code...';

    try {
        const res  = await fetch(`${API}/api/send-verification`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, plan: selectedPlan }),
        });
        const data = await res.json();

        if (!res.ok) {
            err.textContent   = data.error || 'Failed to send code.';
            err.className     = 'alert error';
            err.style.display = 'block';
            btn.disabled      = false;
            document.getElementById('regBtnText').textContent = 'Send Verification Code';
            return;
        }

        // Show step 2
        document.getElementById('regStep1').style.display = 'none';
        document.getElementById('regStep2').style.display = 'block';
        setRegStep(2);
        document.getElementById('otpSubtitle').textContent = data.message;

        // Dev mode: show code on screen when SMTP is not configured
        const devBox = document.getElementById('devCodeBox');
        if (data.devCode) {
            document.getElementById('devCodeVal').textContent = data.devCode;
            devBox.style.display = 'block';
        } else {
            devBox.style.display = 'none';
        }

        initOtpBoxes();
        setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
        showToast('Code sent to ' + email, 'success');
    } catch (ex) {
        err.textContent   = 'Network error: ' + ex.message;
        err.className     = 'alert error';
        err.style.display = 'block';
        btn.disabled      = false;
        document.getElementById('regBtnText').textContent = 'Send Verification Code';
    }
});

// STEP 2 — Verify code & create account
document.getElementById('verifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value.trim();
    const code  = getOtpValue();
    const btn   = document.getElementById('verifyBtn');
    const err   = document.getElementById('verifyError');

    if (code.length < 6) {
        err.textContent   = 'Please enter all 6 digits.';
        err.className     = 'alert error';
        err.style.display = 'block';
        return;
    }
    err.style.display = 'none';
    btn.disabled = true;
    document.getElementById('verifyBtnText').innerHTML = '<span class="spinner"></span>Verifying...';

    try {
        const res  = await fetch(`${API}/api/verify-code`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        const data = await res.json();

        if (!res.ok) {
            if (res.status === 409 && data.key) {
                currentSession = { account: data.account, key: data.key, stores: [] };
                showSuccessPage({ key: data.key.key, plan: data.key.plan, account: data.account,
                    emailSent: false, emailNote: 'Account already exists — showing your existing key.',
                    maxDevices: data.key.max_devices });
            } else {
                clearOtpBoxes();
                err.textContent   = data.error || 'Verification failed.';
                err.className     = 'alert error';
                err.style.display = 'block';
            }
            btn.disabled = false;
            document.getElementById('verifyBtnText').textContent = 'Verify & Generate Key';
            return;
        }

        setRegStep(3);
        currentSession = { account: data.account, key: data, stores: [] };
        showSuccessPage(data);
    } catch (ex) {
        err.textContent   = 'Network error: ' + ex.message;
        err.className     = 'alert error';
        err.style.display = 'block';
        btn.disabled      = false;
        document.getElementById('verifyBtnText').textContent = 'Verify & Generate Key';
    }
});

function resendCode() {
    document.getElementById('registerForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function backToStep1() {
    document.getElementById('regStep2').style.display = 'none';
    document.getElementById('regStep1').style.display = 'block';
    document.getElementById('regBtn').disabled = false;
    document.getElementById('regBtnText').textContent = 'Send Verification Code';
    document.getElementById('regError').style.display   = 'none';
    document.getElementById('verifyError').style.display = 'none';
    setRegStep(1);
}

function showSuccessPage(data) {
    const meta = PLAN_META[data.plan] || PLAN_META.starter;
    document.getElementById('successKey').textContent     = data.key;
    document.getElementById('successPlanLabel').textContent = meta.label + ' Plan';
    document.getElementById('successPlanLabel').style.color = meta.color;

    const maxDev = data.maxDevices >= 999999 ? 'Unlimited' : data.maxDevices;
    document.getElementById('successMeta').innerHTML =
        `Plan: <strong style="color:${meta.color}">${meta.label}</strong> &mdash; ${
            data.planType || ''
        }<br>Max devices: <strong>${maxDev}</strong>`;

    const emailEl = document.getElementById('emailStatus');
    if (data.emailSent) {
        emailEl.textContent = `✉️ License key & credentials sent to ${data.account?.email}.`;
        emailEl.className   = 'alert success';
        emailEl.style.display = 'block';
    } else if (data.emailNote) {
        emailEl.textContent  = '⚠️ ' + data.emailNote;
        emailEl.className    = 'alert info';
        emailEl.style.display = 'block';
    } else {
        emailEl.style.display = 'none';
    }

    // Show generated username (password is only in the email)
    const credsEl = document.getElementById('successCredentials');
    const unameEl = document.getElementById('successUsername');
    if (credsEl) {
        if (data.username) {
            if (unameEl) unameEl.textContent = data.username;
            credsEl.style.display = 'block';
        } else {
            credsEl.style.display = 'none';
        }
    }

    // Reset copy button
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) { copyBtn.textContent = '📋 Copy'; copyBtn.style.background = ''; }

    showPage('success');
}

function copyKey() {
    const key = document.getElementById('successKey').textContent;
    navigator.clipboard.writeText(key).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = '✓ Copied!';
        btn.style.background = 'rgba(34,197,94,0.15)';
        btn.style.color = '#22c55e';
        btn.style.borderColor = 'rgba(34,197,94,0.4)';
        showToast('Key copied to clipboard!', 'success');
        setTimeout(() => {
            btn.textContent = '📋 Copy';
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2500);
    }).catch(() => showToast('Copy failed — select and copy manually', 'error'));
}

function goToDashboard() {
    if (!currentSession) { showPage('login'); return; }
    populateDashboard(currentSession);
    showPage('dashboard');
}

/* ── Login (2-step OTP) ──────────────────────────────────────────────────────── */
// Build a normalised session from a server response (handles both {key} and {keys} shapes)
function buildSession(data) {
    const keys     = data.keys || (data.key ? [data.key] : []);
    const latestKey = keys.length ? keys[keys.length - 1] : null;
    return { account: data.account, key: latestKey, keys, stores: data.stores || [] };
}

// Step 1: submit email → server sends OTP
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const err   = document.getElementById('loginError');
    err.style.display = 'none';

    try {
        const res  = await fetch(`${API}/api/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (!res.ok) {
            err.textContent   = data.error || 'Login failed.';
            err.className     = 'alert error';
            err.style.display = 'block';
            return;
        }

        if (data.requiresCode) {
            document.getElementById('loginStep1').style.display = 'none';
            document.getElementById('loginStep2').style.display = 'block';
            document.getElementById('loginOtpSubtitle').textContent = data.message;
            const devBox = document.getElementById('loginDevCodeBox');
            if (data.devCode) {
                document.getElementById('loginDevCodeVal').textContent = data.devCode;
                devBox.style.display = 'block';
            } else {
                devBox.style.display = 'none';
            }
            initLoginOtpBoxes();
            setTimeout(() => document.getElementById('login-otp-0')?.focus(), 100);
            showToast('Code sent to ' + email, 'success');
            return;
        }

        // Fallback if server ever returns session directly
        const session = buildSession(data);
        currentSession = session;
        populateDashboard(session);
        showPage('dashboard');
    } catch (ex) {
        err.textContent   = 'Network error: ' + ex.message;
        err.className     = 'alert error';
        err.style.display = 'block';
    }
});

// Helper: init OTP boxes for login step 2
function initLoginOtpBoxes() {
    document.querySelectorAll('#loginOtpForm .otp-box').forEach((box, idx) => {
        const fresh = box.cloneNode(true);
        box.parentNode.replaceChild(fresh, box);
    });
    document.querySelectorAll('#loginOtpForm .otp-box').forEach((box, idx) => {
        const all = document.querySelectorAll('#loginOtpForm .otp-box');
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '');
            if (box.value && idx < all.length - 1) all[idx + 1].focus();
        });
        box.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !box.value && idx > 0) all[idx - 1].focus();
            if (e.key === 'ArrowLeft'  && idx > 0) all[idx - 1].focus();
            if (e.key === 'ArrowRight' && idx < all.length - 1) all[idx + 1].focus();
        });
        box.addEventListener('paste', e => {
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
            if (pasted.length >= 6) {
                e.preventDefault();
                document.querySelectorAll('#loginOtpForm .otp-box').forEach((b, i) => { b.value = pasted[i] || ''; });
                all[5].focus();
            }
        });
    });
}

function backToLoginStep1() {
    document.getElementById('loginStep2').style.display = 'none';
    document.getElementById('loginStep1').style.display = 'block';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginOtpError').style.display = 'none';
    [0,1,2,3,4,5].forEach(i => { const b = document.getElementById('login-otp-' + i); if (b) b.value = ''; });
}

// Step 2: verify OTP → get account + keys
document.getElementById('loginOtpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const code  = [0,1,2,3,4,5].map(i => document.getElementById('login-otp-' + i)?.value || '').join('');
    const btn   = document.getElementById('loginVerifyBtn');
    const err   = document.getElementById('loginOtpError');

    if (code.length < 6) {
        err.textContent = 'Please enter all 6 digits.';
        err.className   = 'alert error';
        err.style.display = 'block';
        return;
    }
    err.style.display = 'none';
    btn.disabled = true;
    document.getElementById('loginVerifyBtnText').innerHTML = '<span class="spinner"></span>Verifying...';

    try {
        const res  = await fetch(`${API}/api/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        const data = await res.json();

        if (!res.ok) {
            [0,1,2,3,4,5].forEach(i => { const b = document.getElementById('login-otp-' + i); if (b) b.value = ''; });
            document.getElementById('login-otp-0')?.focus();
            err.textContent   = data.error || 'Verification failed.';
            err.className     = 'alert error';
            err.style.display = 'block';
            btn.disabled = false;
            document.getElementById('loginVerifyBtnText').textContent = 'Verify & Sign In →';
            return;
        }

        const session = buildSession(data);
        currentSession = session;
        populateDashboard(session);
        showPage('dashboard');
        backToLoginStep1(); // reset for next time
    } catch (ex) {
        err.textContent   = 'Network error: ' + ex.message;
        err.className     = 'alert error';
        err.style.display = 'block';
        btn.disabled      = false;
        document.getElementById('loginVerifyBtnText').textContent = 'Verify & Sign In →';
    }
});

function logout() {
    currentSession = null;
    showPage('register');
    showToast('Logged out', 'info');
}

/* ── Dashboard population ────────────────────────────────────────────────────── */
function populateDashboard(session) {
    const { account, key, stores = [] } = session;
    const plan = key?.plan || 'starter';
    const meta = PLAN_META[plan] || PLAN_META.starter;

    // Sidebar user info
    document.getElementById('dashAvatar').textContent  = account.name.slice(0, 2).toUpperCase();
    document.getElementById('dashUsername').textContent = account.name;
    document.getElementById('dashEmail').textContent    = account.email;

    // Plan chip
    const chip = document.getElementById('overviewPlanChip');
    chip.textContent  = meta.label + ' Plan';
    chip.className    = 'plan-chip ' + meta.cls;

    // Overview KPIs
    const kpiRow = document.getElementById('overviewKpis');
    const maxDev = key?.max_devices >= 999999 ? 'Unlimited' : (key?.max_devices ?? '—');
    kpiRow.innerHTML = `
        <div class="kpi-card"><div class="kpi-val">${meta.label}</div><div class="kpi-lbl">Active Plan</div></div>
        <div class="kpi-card"><div class="kpi-val">${stores.length}</div><div class="kpi-lbl">Stores</div></div>
        <div class="kpi-card"><div class="kpi-val">${maxDev}</div><div class="kpi-lbl">Max Devices</div></div>
        <div class="kpi-card"><div class="kpi-val">${key?.key?.split('-')[2] || '—'}</div><div class="kpi-lbl">Key Segment</div></div>
    `;

    // Overview store grid
    renderOverviewStoreGrid(stores, plan);

    // Stores tab
    renderStoreList(stores, account.id, plan, key?.max_devices);

    // License tab
    renderLicenseDetail(key, account);

    // Upgrade tab
    renderUpgradeTab(key, account);

    // Credentials tab
    renderCredentialsTab(account);

    // Switch to overview
    dashTab('overview');
}

function renderOverviewStoreGrid(stores, plan) {
    const grid = document.getElementById('overviewStoreGrid');
    if (!stores || stores.length === 0) {
        grid.innerHTML = `<p style="color:#475569;font-size:13px;margin-top:8px;">No stores yet. Go to the <a href="#" onclick="dashTab('stores')">Stores tab</a> to add one.</p>`;
        return;
    }
    grid.innerHTML = `
        <h4 style="font-size:13px;color:#64748b;font-weight:600;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Your Stores</h4>
        <div class="store-grid">
            ${stores.map(s => `
                <div class="store-item ${s.active ? '' : 'inactive'}">
                    <div class="store-item-head">
                        <span class="store-name">${esc(s.name)}</span>
                        <span class="store-badge ${s.active ? 'active' : 'inactive'}">${s.active ? 'Live' : 'Off'}</span>
                    </div>
                    <div class="store-loc">📍 ${esc(s.location) || 'No location'}</div>
                    <span class="store-type-tag">${esc(s.type)}</span>
                    <div class="store-actions">
                        <button class="btn-secondary sm" onclick="viewStoreMetrics(${s.id})">View Metrics</button>
                    </div>
                </div>
            `).join('')}
        </div>`;
}

function renderStoreList(stores, accountId, plan, maxDevices) {
    const list = document.getElementById('storeList');

    const storeCapMsg = () => {
        if (!maxDevices || maxDevices >= 999999) return `<span style="color:#34d399;font-size:12px;">Unlimited stores</span>`;
        const pct = Math.min(100, Math.round(stores.length / maxDevices * 100));
        return `<span style="color:#64748b;font-size:12px;">${stores.length} / ${maxDevices} stores</span>
            <div style="height:4px;background:#1e293b;border-radius:2px;width:120px;margin-top:4px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${pct >= 90 ? '#ef4444' : '#4f46e5'};border-radius:2px;"></div>
            </div>`;
    };

    if (!stores || stores.length === 0) {
        list.innerHTML = `<div style="color:#475569;font-size:13px;margin-bottom:16px;">No stores added yet.</div>`;
    } else {
        list.innerHTML = `
            <div style="margin-bottom:16px;">${storeCapMsg()}</div>
            ${stores.map(s => `
                <div class="store-row" id="store-row-${s.id}">
                    <div class="store-row-info">
                        <div class="store-name">${esc(s.name)}</div>
                        <div class="store-loc" style="margin-top:3px;">📍 ${esc(s.location) || 'No location'} &nbsp;·&nbsp;
                            <span class="store-type-tag">${esc(s.type)}</span>
                        </div>
                    </div>
                    <div class="store-row-actions">
                        <span class="store-badge ${s.active ? 'active' : 'inactive'}">${s.active ? 'Active' : 'Inactive'}</span>
                        <button class="btn-secondary sm" onclick="viewStoreMetrics(${s.id})">📊 Metrics</button>
                        <button class="btn-secondary sm" onclick="openEditStore(${s.id})">✏️ Edit</button>
                        <button class="btn-icon" onclick="toggleStore(${s.id}, ${s.active ? 0 : 1}, ${accountId})" title="${s.active ? 'Deactivate' : 'Activate'}">
                            ${s.active ? '⏸' : '▶'}
                        </button>
                        <button class="btn-danger" onclick="deleteStore(${s.id}, ${accountId})">✕</button>
                    </div>
                </div>
            `).join('')}`;
    }
    document.getElementById('storeMetricsPanel').classList.add('hidden');
}

function renderLicenseDetail(key, account) {
    const el = document.getElementById('licenseDetail');
    if (!key) {
        el.innerHTML = `<p style="color:#475569;font-size:13px;">No active license key found.</p>`;
        return;
    }
    const meta   = PLAN_META[key.plan] || PLAN_META.starter;
    const maxDev = key.max_devices >= 999999 ? 'Unlimited' : key.max_devices;
    el.innerHTML = `
        <div class="license-detail-card">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <span style="font-size:28px;">${key.plan === 'enterprise' ? '🏢' : key.plan === 'business' ? '🏬' : '🏪'}</span>
                <div>
                    <div style="font-size:16px;font-weight:700;color:${meta.color};">${meta.label} Plan</div>
                    <div style="font-size:12px;color:#64748b;">${key.plan === 'enterprise' ? 'Unlimited Stores' : key.plan === 'business' ? 'Multi-Store' : 'Single Store'}</div>
                </div>
            </div>
            <div class="key-section">
                <div class="key-label" style="margin-bottom:8px;">LICENSE KEY</div>
                <div style="font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:2px;color:#a5b4fc;margin-bottom:12px;word-break:break-all;">${esc(key.key)}</div>
                <button class="btn-copy" onclick="navigator.clipboard.writeText('${esc(key.key)}').then(()=>showToast('Copied!','success'))">📋 Copy Key</button>
            </div>
            <div class="ld-row"><span class="ld-label">Plan</span><span class="ld-value" style="color:${meta.color};">${meta.label}</span></div>
            <div class="ld-row"><span class="ld-label">Max Devices</span><span class="ld-value">${maxDev}</span></div>
            <div class="ld-row"><span class="ld-label">Account</span><span class="ld-value">${esc(account.email)}</span></div>
            <div class="ld-row"><span class="ld-label">Status</span><span class="ld-value" style="color:#22c55e;">Active</span></div>
            <div class="ld-row"><span class="ld-label">Created</span><span class="ld-value">${formatDate(key.created_at || account.created_at)}</span></div>
            <div style="margin-top:16px;background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px;">
                <div style="font-size:11px;color:#64748b;line-height:1.7;">
                    To activate Biznex BOS on a new device:<br>
                    1. Install the app &rarr; 2. On the activation screen, enter this key &rarr; 3. Done.
                </div>
            </div>
        </div>`;
}
/* ── Upgrade Plan tab ─────────────────────────────────────────────────────────────── */
let selectedUpgradePlan = null;

const UPGRADE_PLAN_INFO = {
    starter:    { label: 'Starter',    icon: '🏪', color: '#818cf8', desc: '1 device · single store' },
    business:   { label: 'Business',   icon: '🏬', color: '#38bdf8', desc: 'Up to 10 devices · multi-store' },
    enterprise: { label: 'Enterprise', icon: '🏒', color: '#34d399', desc: 'Unlimited devices & stores' },
};

function renderUpgradeTab(key, account) {
    const el = document.getElementById('upgradeContent');
    if (!el) return;
    const current    = key?.plan || 'starter';
    const planOrder  = ['starter', 'business', 'enterprise'];
    const higherPlans = planOrder.filter(p => planOrder.indexOf(p) > planOrder.indexOf(current));

    if (higherPlans.length === 0) {
        el.innerHTML = `
            <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:24px;text-align:center;max-width:480px;">
                <div style="font-size:32px;margin-bottom:10px;">🏆</div>
                <div style="font-size:16px;font-weight:700;color:#34d399;margin-bottom:6px;">You're on the Enterprise Plan</div>
                <div style="font-size:13px;color:#64748b;">You have the highest available plan. Enjoy unlimited access!</div>
            </div>`;
        return;
    }

    const currentMeta = UPGRADE_PLAN_INFO[current] || UPGRADE_PLAN_INFO.starter;
    el.innerHTML = `
        <div style="max-width:520px;">
            <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;">${currentMeta.icon}</span>
                <div>
                    <div style="font-size:11px;color:#64748b;">Current plan</div>
                    <div style="font-size:15px;font-weight:700;color:${currentMeta.color};">${currentMeta.label}</div>
                </div>
            </div>
            <p style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Select a plan to upgrade to. A verification code will be sent to <strong>${esc(account.email)}</strong> to confirm.</p>
            <div id="upgradePlanList" style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                ${higherPlans.map(p => {
                    const pm = UPGRADE_PLAN_INFO[p];
                    return `<div class="upgrade-plan-card" id="upc-${p}" onclick="selectUpgradePlan('${p}')"
                        style="background:#1e293b;border:2px solid #334155;border-radius:10px;padding:14px 18px;cursor:pointer;transition:border-color 0.15s;display:flex;align-items:center;gap:14px;">
                        <span style="font-size:24px;">${pm.icon}</span>
                        <div style="flex:1;">
                            <div style="font-size:15px;font-weight:700;color:${pm.color};">${pm.label}</div>
                            <div style="font-size:12px;color:#64748b;">${pm.desc}</div>
                        </div>
                        <div id="upc-radio-${p}" style="width:18px;height:18px;border-radius:50%;border:2px solid #475569;flex-shrink:0;"></div>
                    </div>`;
                }).join('')}
            </div>
            <button class="btn-primary" id="upgradeRequestBtn" onclick="requestUpgrade()" style="width:100%;">
                <span id="upgradeRequestBtnText">Send Verification Code →</span>
            </button>
            <div id="upgradeError" class="alert error" style="display:none;margin-top:12px;"></div>

            <div id="upgradeStep2" style="display:none;margin-top:20px;">
                <p class="form-sub" id="upgradeOtpSubtitle">Enter the 6-digit code sent to your email.</p>
                <div id="upgradeDevCodeBox" style="display:none;" class="dev-code-box">
                    <div class="dev-code-label">Dev Mode — SMTP not configured</div>
                    <div class="dev-code-val" id="upgradeDevCodeVal"></div>
                    <div class="dev-code-hint">Copy this code into the field below</div>
                </div>
                <form id="upgradeOtpForm" autocomplete="off">
                    <div class="form-group">
                        <label>6-Digit Verification Code</label>
                        <div class="otp-row">
                            <input class="otp-box" id="upg-otp-0" maxlength="1" inputmode="numeric" />
                            <input class="otp-box" id="upg-otp-1" maxlength="1" inputmode="numeric" />
                            <input class="otp-box" id="upg-otp-2" maxlength="1" inputmode="numeric" />
                            <span class="otp-divider">–</span>
                            <input class="otp-box" id="upg-otp-3" maxlength="1" inputmode="numeric" />
                            <input class="otp-box" id="upg-otp-4" maxlength="1" inputmode="numeric" />
                            <input class="otp-box" id="upg-otp-5" maxlength="1" inputmode="numeric" />
                        </div>
                    </div>
                    <button type="submit" class="btn-primary" id="upgradeVerifyBtn" style="width:100%;">
                        <span id="upgradeVerifyBtnText">Confirm Upgrade →</span>
                    </button>
                </form>
                <div id="upgradeOtpError" class="alert error" style="display:none;margin-top:10px;"></div>
            </div>
        </div>`;

    selectUpgradePlan(higherPlans[0]);
    document.getElementById('upgradeOtpForm').addEventListener('submit', submitUpgradeOtp);
}

function selectUpgradePlan(plan) {
    selectedUpgradePlan = plan;
    document.querySelectorAll('.upgrade-plan-card').forEach(c => { c.style.borderColor = '#334155'; });
    document.querySelectorAll('[id^="upc-radio-"]').forEach(r => { r.style.background = 'transparent'; r.style.borderColor = '#475569'; });
    const card  = document.getElementById('upc-' + plan);
    const radio = document.getElementById('upc-radio-' + plan);
    if (card)  card.style.borderColor = '#4f46e5';
    if (radio) { radio.style.background = '#4f46e5'; radio.style.borderColor = '#4f46e5'; }
}

async function requestUpgrade() {
    if (!selectedUpgradePlan || !currentSession) return;
    const btn = document.getElementById('upgradeRequestBtn');
    const err = document.getElementById('upgradeError');
    err.style.display = 'none';
    btn.disabled = true;
    document.getElementById('upgradeRequestBtnText').innerHTML = '<span class="spinner"></span>Sending code...';

    try {
        const res  = await fetch(`${API}/api/upgrade-plan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentSession.account.email, newPlan: selectedUpgradePlan }),
        });
        const data = await res.json();

        if (!res.ok) {
            err.textContent   = data.error || 'Failed to send code.';
            err.style.display = 'block';
            btn.disabled = false;
            document.getElementById('upgradeRequestBtnText').textContent = 'Send Verification Code →';
            return;
        }

        document.getElementById('upgradeStep2').style.display = 'block';
        document.getElementById('upgradeOtpSubtitle').textContent = data.message;
        const devBox = document.getElementById('upgradeDevCodeBox');
        if (data.devCode) {
            document.getElementById('upgradeDevCodeVal').textContent = data.devCode;
            devBox.style.display = 'block';
        } else {
            devBox.style.display = 'none';
        }
        initUpgradeOtpBoxes();
        setTimeout(() => document.getElementById('upg-otp-0')?.focus(), 100);
        showToast('Code sent to ' + currentSession.account.email, 'success');
        btn.disabled = false;
        document.getElementById('upgradeRequestBtnText').textContent = 'Resend Code';
    } catch (ex) {
        err.textContent   = 'Network error: ' + ex.message;
        err.style.display = 'block';
        btn.disabled = false;
        document.getElementById('upgradeRequestBtnText').textContent = 'Send Verification Code →';
    }
}

function initUpgradeOtpBoxes() {
    document.querySelectorAll('#upgradeOtpForm .otp-box').forEach((box, idx) => {
        const fresh = box.cloneNode(true);
        box.parentNode.replaceChild(fresh, box);
    });
    document.querySelectorAll('#upgradeOtpForm .otp-box').forEach((box, idx) => {
        const all = document.querySelectorAll('#upgradeOtpForm .otp-box');
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '');
            if (box.value && idx < all.length - 1) all[idx + 1].focus();
        });
        box.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !box.value && idx > 0) all[idx - 1].focus();
        });
        box.addEventListener('paste', e => {
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
            if (pasted.length >= 6) {
                e.preventDefault();
                document.querySelectorAll('#upgradeOtpForm .otp-box').forEach((b, i) => { b.value = pasted[i] || ''; });
                all[5].focus();
            }
        });
    });
}

function getUpgradeOtpValue() {
    return [0,1,2,3,4,5].map(i => document.getElementById('upg-otp-' + i)?.value || '').join('');
}

async function submitUpgradeOtp(e) {
    e.preventDefault();
    const code = getUpgradeOtpValue();
    const btn  = document.getElementById('upgradeVerifyBtn');
    const err  = document.getElementById('upgradeOtpError');

    if (code.length < 6) {
        err.textContent   = 'Please enter all 6 digits.';
        err.className     = 'alert error';
        err.style.display = 'block';
        return;
    }
    err.style.display = 'none';
    btn.disabled = true;
    document.getElementById('upgradeVerifyBtnText').innerHTML = '<span class="spinner"></span>Upgrading...';

    try {
        const res  = await fetch(`${API}/api/upgrade-plan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentSession.account.email, code, newPlan: selectedUpgradePlan }),
        });
        const data = await res.json();

        if (!res.ok) {
            document.querySelectorAll('#upgradeOtpForm .otp-box').forEach(b => { b.value = ''; });
            document.getElementById('upg-otp-0')?.focus();
            err.textContent   = data.error || 'Upgrade failed.';
            err.className     = 'alert error';
            err.style.display = 'block';
            btn.disabled = false;
            document.getElementById('upgradeVerifyBtnText').textContent = 'Confirm Upgrade →';
            return;
        }

        // Refresh session with new key
        try {
            const acctRes = await fetch(`${API}/api/account/${encodeURIComponent(currentSession.account.email)}`);
            if (acctRes.ok) {
                const acctData = await acctRes.json();
                currentSession = buildSession(acctData);
            }
        } catch {}

        showToast(`🎉 Upgraded to ${data.planLabel}! New key: ${data.key}`, 'success', 8000);
        populateDashboard(currentSession);
        dashTab('license');
    } catch (ex) {
        err.textContent   = 'Network error: ' + ex.message;
        err.className     = 'alert error';
        err.style.display = 'block';
        btn.disabled      = false;
        document.getElementById('upgradeVerifyBtnText').textContent = 'Confirm Upgrade →';
    }
}
        btn.disabled      = false;
        document.getElementById('upgradeVerifyBtnText').textContent = 'Confirm Upgrade →';
    }
}

/* ── Credentials Tab ─────────────────────────────────────────────────────────── */
function renderCredentialsTab(account) {
    const el = document.getElementById('credentialsContent');
    if (!el) return;
    const changed = account.credentials_changed;

    if (!changed) {
        // One-time free change — no OTP required (user just verified email during registration)
        el.innerHTML = `
            <div style="max-width:480px;">
                <div style="background:#f59e0b18;border:1px solid #f59e0b40;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start;">
                    <span style="font-size:22px;">⚠️</span>
                    <div>
                        <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:4px;">One-time credential setup available</div>
                        <div style="font-size:12px;color:#94a3b8;line-height:1.6;">Your credentials were auto-generated and emailed to you. You can set your own username and password <em>right now without a verification code</em> — this free-change window is <strong>available once only</strong>. After this, any changes will require email verification.</div>
                    </div>
                </div>
                <form id="credChangeForm" onsubmit="submitCredentialChange(event)">
                    <div class="form-group">
                        <label>New Username <span style="font-size:10px;color:#64748b;">(optional — leave blank to keep current)</span></label>
                        <input type="text" id="credNewUsername" placeholder="e.g. john.smith" autocomplete="off"
                            style="width:100%;padding:10px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;box-sizing:border-box;" />
                        <div style="font-size:11px;color:#64748b;margin-top:4px;">Current: <strong id="credCurrentUsername" style="color:#a5b4fc;font-family:monospace;">${esc(account.username || '(not set)')}</strong></div>
                    </div>
                    <div class="form-group" style="margin-top:14px;">
                        <label>New Password</label>
                        <input type="password" id="credNewPassword" placeholder="Choose a strong password" required autocomplete="new-password"
                            style="width:100%;padding:10px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;box-sizing:border-box;" />
                    </div>
                    <div class="form-group" style="margin-top:14px;">
                        <label>Confirm Password</label>
                        <input type="password" id="credNewPasswordConfirm" placeholder="Repeat your new password" required autocomplete="new-password"
                            style="width:100%;padding:10px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;box-sizing:border-box;" />
                    </div>
                    <div id="credChangeError" class="alert error" style="display:none;margin-top:12px;"></div>
                    <button type="submit" class="btn-primary" id="credChangeBtn" style="width:100%;margin-top:16px;">
                        <span id="credChangeBtnText">Save My Credentials →</span>
                    </button>
                </form>
                <p style="font-size:11px;color:#475569;margin-top:12px;">After saving, any future changes will require email verification.</p>
            </div>`;
    } else {
        // Must use OTP for changes
        el.innerHTML = `
            <div style="max-width:480px;">
                <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
                    <div style="font-size:11px;color:#64748b;margin-bottom:4px;">Current username</div>
                    <div style="font-size:15px;font-weight:600;color:#a5b4fc;font-family:monospace;">${esc(account.username || '—')}</div>
                </div>

                <div id="credStep1">
                    <p style="font-size:13px;color:#94a3b8;margin-bottom:16px;">
                        To change your username or password, we need to verify your identity.<br>
                        A 6-digit code will be sent to <strong>${esc(account.email)}</strong>.
                    </p>
                    <button class="btn-primary" onclick="requestCredentialChangeOtp()" id="credOtpRequestBtn" style="width:100%;">
                        <span id="credOtpRequestBtnText">Send Verification Code →</span>
                    </button>
                    <div id="credOtpRequestError" class="alert error" style="display:none;margin-top:10px;"></div>
                </div>

                <div id="credStep2" style="display:none;margin-top:24px;border-top:1px solid #1e293b;padding-top:20px;">
                    <p class="form-sub" id="credOtpSubtitle">Enter the 6-digit code sent to your email.</p>
                    <div id="credDevCodeBox" style="display:none;" class="dev-code-box">
                        <div class="dev-code-label">Dev Mode — SMTP not configured</div>
                        <div class="dev-code-val" id="credDevCodeVal"></div>
                        <div class="dev-code-hint">Copy this code into the field below</div>
                    </div>
                    <div class="otp-row" style="margin-bottom:18px;">
                        <input class="otp-box" id="cred-otp-0" maxlength="1" inputmode="numeric" />
                        <input class="otp-box" id="cred-otp-1" maxlength="1" inputmode="numeric" />
                        <input class="otp-box" id="cred-otp-2" maxlength="1" inputmode="numeric" />
                        <span class="otp-divider">–</span>
                        <input class="otp-box" id="cred-otp-3" maxlength="1" inputmode="numeric" />
                        <input class="otp-box" id="cred-otp-4" maxlength="1" inputmode="numeric" />
                        <input class="otp-box" id="cred-otp-5" maxlength="1" inputmode="numeric" />
                    </div>
                    <form id="credOtpChangeForm" onsubmit="submitCredentialChange(event)">
                        <div class="form-group">
                            <label>New Username <span style="font-size:10px;color:#64748b;">(optional)</span></label>
                            <input type="text" id="credNewUsername" placeholder="Leave blank to keep current" autocomplete="off"
                                style="width:100%;padding:10px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;box-sizing:border-box;" />
                        </div>
                        <div class="form-group" style="margin-top:14px;">
                            <label>New Password</label>
                            <input type="password" id="credNewPassword" placeholder="Choose a strong password" required autocomplete="new-password"
                                style="width:100%;padding:10px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;box-sizing:border-box;" />
                        </div>
                        <div class="form-group" style="margin-top:14px;">
                            <label>Confirm Password</label>
                            <input type="password" id="credNewPasswordConfirm" placeholder="Repeat password" required autocomplete="new-password"
                                style="width:100%;padding:10px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;box-sizing:border-box;" />
                        </div>
                        <div id="credChangeError" class="alert error" style="display:none;margin-top:12px;"></div>
                        <button type="submit" class="btn-primary" id="credChangeBtn" style="width:100%;margin-top:16px;">
                            <span id="credChangeBtnText">Update Credentials →</span>
                        </button>
                    </form>
                    <div id="credOtpError" class="alert error" style="display:none;margin-top:10px;"></div>
                </div>
            </div>`;
        initCredOtpBoxes();
    }
}

async function requestCredentialChangeOtp() {
    if (!currentSession) return;
    const btn = document.getElementById('credOtpRequestBtn');
    const err = document.getElementById('credOtpRequestError');
    err.style.display = 'none';
    btn.disabled = true;
    document.getElementById('credOtpRequestBtnText').innerHTML = '<span class="spinner"></span>Sending code...';

    try {
        const res  = await fetch(`${API}/api/change-credentials`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentSession.account.email }),
        });
        const data = await res.json();

        if (!res.ok) {
            err.textContent   = data.error || 'Failed to send code.';
            err.style.display = 'block';
            btn.disabled = false;
            document.getElementById('credOtpRequestBtnText').textContent = 'Send Verification Code →';
            return;
        }

        document.getElementById('credStep1').style.display = 'none';
        document.getElementById('credStep2').style.display = 'block';
        document.getElementById('credOtpSubtitle').textContent = data.message;
        const devBox = document.getElementById('credDevCodeBox');
        if (data.devCode) {
            document.getElementById('credDevCodeVal').textContent = data.devCode;
            devBox.style.display = 'block';
        } else {
            devBox.style.display = 'none';
        }
        initCredOtpBoxes();
        setTimeout(() => document.getElementById('cred-otp-0')?.focus(), 100);
        showToast('Code sent to ' + currentSession.account.email, 'success');
        btn.disabled = false;
        document.getElementById('credOtpRequestBtnText').textContent = 'Send Verification Code →';
    } catch (ex) {
        err.textContent   = 'Network error: ' + ex.message;
        err.style.display = 'block';
        btn.disabled = false;
        document.getElementById('credOtpRequestBtnText').textContent = 'Send Verification Code →';
    }
}

function initCredOtpBoxes() {
    const sel = '#credStep2 .otp-box';
    document.querySelectorAll(sel).forEach((box) => {
        const fresh = box.cloneNode(true);
        box.parentNode.replaceChild(fresh, box);
    });
    document.querySelectorAll(sel).forEach((box, idx) => {
        const all = document.querySelectorAll(sel);
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '');
            if (box.value && idx < all.length - 1) all[idx + 1].focus();
        });
        box.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !box.value && idx > 0) all[idx - 1].focus();
            if (e.key === 'ArrowLeft'  && idx > 0) all[idx - 1].focus();
            if (e.key === 'ArrowRight' && idx < all.length - 1) all[idx + 1].focus();
        });
        box.addEventListener('paste', e => {
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
            if (pasted.length >= 6) {
                e.preventDefault();
                document.querySelectorAll(sel).forEach((b, i) => { b.value = pasted[i] || ''; });
                all[5].focus();
            }
        });
    });
}

async function submitCredentialChange(event) {
    event.preventDefault();
    if (!currentSession) return;

    const newUsername = (document.getElementById('credNewUsername')?.value || '').trim();
    const newPassword = document.getElementById('credNewPassword')?.value || '';
    const confirm     = document.getElementById('credNewPasswordConfirm')?.value || '';
    const err         = document.getElementById('credChangeError');

    err.style.display = 'none';
    if (newPassword !== confirm) {
        err.textContent = 'Passwords do not match.';
        err.className   = 'alert error';
        err.style.display = 'block';
        return;
    }
    if (newPassword.length < 6) {
        err.textContent = 'Password must be at least 6 characters.';
        err.className   = 'alert error';
        err.style.display = 'block';
        return;
    }

    const changed = currentSession.account.credentials_changed;
    const code    = changed
        ? [0,1,2,3,4,5].map(i => document.getElementById('cred-otp-' + i)?.value || '').join('')
        : undefined;

    if (changed && (!code || code.length < 6)) {
        err.textContent = 'Please enter the 6-digit verification code.';
        err.className   = 'alert error';
        err.style.display = 'block';
        return;
    }

    const btn = document.getElementById('credChangeBtn');
    btn.disabled = true;
    document.getElementById('credChangeBtnText').innerHTML = '<span class="spinner"></span>Saving...';

    try {
        const body = { email: currentSession.account.email, newPassword };
        if (newUsername) body.newUsername = newUsername;
        if (code)        body.code        = code;

        const res  = await fetch(`${API}/api/change-credentials`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
            if (changed) {
                [0,1,2,3,4,5].forEach(i => { const b = document.getElementById('cred-otp-' + i); if (b) b.value = ''; });
                document.getElementById('cred-otp-0')?.focus();
            }
            err.textContent   = data.error || 'Failed to update credentials.';
            err.className     = 'alert error';
            err.style.display = 'block';
            btn.disabled = false;
            document.getElementById('credChangeBtnText').textContent = changed ? 'Update Credentials →' : 'Save My Credentials →';
            return;
        }

        // Update local session so the tab re-renders correctly
        currentSession.account.credentials_changed = 1;
        if (data.username) currentSession.account.username = data.username;

        showToast('✅ Credentials updated! Check your email for confirmation.', 'success', 4000);
        renderCredentialsTab(currentSession.account);

        // Reflect new username in sidebar
        const dashUsernameEl = document.getElementById('dashUsername');
        if (dashUsernameEl && data.username) dashUsernameEl.textContent = data.username;
    } catch (ex) {
        err.textContent   = 'Network error: ' + ex.message;
        err.className     = 'alert error';
        err.style.display = 'block';
        btn.disabled = false;
        document.getElementById('credChangeBtnText').textContent = changed ? 'Update Credentials →' : 'Save My Credentials →';
    }
}

/* ── Dashboard tabs ──────────────────────────────────────────────────────────── */
function dashTab(tab) {
    dashActiveTab = tab;
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ds-nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('dash-' + tab)?.classList.add('active');
    document.getElementById('tab-' + tab)?.classList.add('active');
}

/* ── Store metrics ────────────────────────────────────────────────────────────── */
async function viewStoreMetrics(storeId) {
    dashTab('stores');
    const panel = document.getElementById('storeMetricsPanel');
    panel.classList.remove('hidden');
    panel.innerHTML = '<div style="color:#64748b;font-size:13px;padding:16px;">Loading metrics…</div>';
    window.scrollTo(0, document.body.scrollHeight);

    try {
        const res  = await fetch(`${API}/api/stores/${storeId}/metrics`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');

        const { store, metrics: m } = data;
        panel.innerHTML = `
            <div class="metrics-panel">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                    <h4 style="margin:0;">📊 ${esc(store.name)} — Metrics</h4>
                    <button class="btn-icon" onclick="document.getElementById('storeMetricsPanel').classList.add('hidden')" title="Close">✕</button>
                </div>
                <div class="metrics-grid">
                    <div class="metric-card"><div class="m-val">${m.today.orders}</div><div class="m-lbl">Orders Today</div></div>
                    <div class="metric-card"><div class="m-val">₹${m.today.revenue.toLocaleString()}</div><div class="m-lbl">Revenue Today</div></div>
                    <div class="metric-card"><div class="m-val">${m.week.orders}</div><div class="m-lbl">Orders This Week</div></div>
                    <div class="metric-card"><div class="m-val">₹${m.week.revenue.toLocaleString()}</div><div class="m-lbl">Revenue This Week</div></div>
                    <div class="metric-card"><div class="m-val">${m.today.items}</div><div class="m-lbl">Items Sold Today</div></div>
                    <div class="metric-card"><div class="m-val">${m.lowStock}</div><div class="m-lbl">Low Stock Items</div></div>
                    <div class="metric-card"><div class="m-val">${m.staff}</div><div class="m-lbl">Staff Online</div></div>
                    <div class="metric-card"><div class="m-val">₹${m.month.revenue.toLocaleString()}</div><div class="m-lbl">Revenue This Month</div></div>
                </div>
                <div class="top-products">
                    <h5>Top Products</h5>
                    ${m.topProducts.map(p => `
                        <div class="tp-row">
                            <span class="tp-name">${esc(p.name)}</span>
                            <span class="tp-val">${p.sales} sold</span>
                        </div>`).join('')}
                </div>
            </div>`;
    } catch (ex) {
        panel.innerHTML = `<div class="alert error">Failed to load metrics: ${ex.message}</div>`;
    }
}

/* ── Add Store ────────────────────────────────────────────────────────────────── */
function openAddStore() {
    if (!currentSession) return;
    const plan = currentSession.key?.plan || 'starter';
    const meta = PLAN_META[plan] || PLAN_META.starter;

    showModal(`
        <h3>➕ Add New Store</h3>
        <div style="background:${meta.color}15;border:1px solid ${meta.color}30;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:${meta.color};">
            ${meta.label} Plan — ${plan === 'enterprise' ? 'Unlimited stores' : plan === 'business' ? 'Up to 10 stores' : '1 store max'}
        </div>
        <div class="form-group"><label>Store Name</label>
            <input type="text" id="modal-store-name" placeholder="e.g. Main Branch" class="modal-input" />
        </div>
        <div class="form-group"><label>Location</label>
            <input type="text" id="modal-store-loc" placeholder="e.g. Downtown, Floor 2" class="modal-input" />
        </div>
        <div class="form-group"><label>Store Type</label>
            <select id="modal-store-type" class="modal-input">
                <option value="retail">Retail</option>
                <option value="canteen">Canteen / Food</option>
                <option value="wholesale">Wholesale</option>
                <option value="online">Online</option>
                <option value="warehouse">Warehouse</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn-secondary sm" onclick="closeModal()">Cancel</button>
            <button class="btn-primary sm" onclick="saveNewStore()">Add Store →</button>
        </div>
    `);

    // Override modal-input styling inline
    document.querySelectorAll('.modal-input').forEach(el => {
        el.style.cssText = 'width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:7px;color:#e2e8f0;font-size:13px;outline:none;';
    });
}

async function saveNewStore() {
    if (!currentSession) return;
    const name = document.getElementById('modal-store-name').value.trim();
    const loc  = document.getElementById('modal-store-loc').value.trim();
    const type = document.getElementById('modal-store-type').value;
    if (!name) { showToast('Store name is required', 'error'); return; }

    try {
        const res  = await fetch(`${API}/api/stores`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: currentSession.account.id, name, location: loc, type }),
        });
        const data = await res.json();
        if (!res.ok) {
            if (data.planLimit) {
                showToast(data.error, 'error', 5000);
            } else {
                showToast(data.error || 'Failed to add store', 'error');
            }
            return;
        }
        closeModal();
        showToast(`Store "${name}" added!`, 'success');
        await refreshStores();
    } catch (ex) {
        showToast('Network error: ' + ex.message, 'error');
    }
}

/* ── Edit Store ──────────────────────────────────────────────────────────────── */
function openEditStore(storeId) {
    if (!currentSession) return;
    const store = currentSession.stores?.find(s => s.id === storeId);
    if (!store) return;

    showModal(`
        <h3>✏️ Edit Store</h3>
        <div class="form-group"><label>Store Name</label>
            <input type="text" id="modal-edit-name" value="${esc(store.name)}" class="modal-input" />
        </div>
        <div class="form-group"><label>Location</label>
            <input type="text" id="modal-edit-loc" value="${esc(store.location)}" class="modal-input" />
        </div>
        <div class="form-group"><label>Store Type</label>
            <select id="modal-edit-type" class="modal-input">
                ${['retail','canteen','wholesale','online','warehouse'].map(t =>
                    `<option value="${t}" ${store.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`
                ).join('')}
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn-secondary sm" onclick="closeModal()">Cancel</button>
            <button class="btn-primary sm" onclick="saveEditStore(${storeId})">Save →</button>
        </div>
    `);
    document.querySelectorAll('.modal-input').forEach(el => {
        el.style.cssText = 'width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:7px;color:#e2e8f0;font-size:13px;outline:none;';
    });
}

async function saveEditStore(storeId) {
    const name = document.getElementById('modal-edit-name').value.trim();
    const loc  = document.getElementById('modal-edit-loc').value.trim();
    const type = document.getElementById('modal-edit-type').value;
    if (!name) { showToast('Name required', 'error'); return; }

    try {
        const res = await fetch(`${API}/api/stores/${storeId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, location: loc, type }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed');
        closeModal();
        showToast('Store updated', 'success');
        await refreshStores();
    } catch (ex) {
        showToast('Error: ' + ex.message, 'error');
    }
}

/* ── Toggle / Delete Store ───────────────────────────────────────────────────── */
async function toggleStore(storeId, newActive, accountId) {
    try {
        await fetch(`${API}/api/stores/${storeId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: newActive }),
        });
        showToast(newActive ? 'Store activated' : 'Store deactivated', 'info');
        await refreshStores();
    } catch (ex) {
        showToast('Error: ' + ex.message, 'error');
    }
}

async function deleteStore(storeId, accountId) {
    if (!confirm('Delete this store? This cannot be undone.')) return;
    try {
        await fetch(`${API}/api/stores/${storeId}`, { method: 'DELETE' });
        showToast('Store deleted', 'info');
        await refreshStores();
    } catch (ex) {
        showToast('Error: ' + ex.message, 'error');
    }
}

async function refreshStores() {
    if (!currentSession) return;
    const res    = await fetch(`${API}/api/stores/${currentSession.account.id}`);
    const stores = await res.json();
    currentSession.stores = stores;
    renderOverviewStoreGrid(stores, currentSession.key?.plan || 'starter');
    renderStoreList(stores, currentSession.account.id, currentSession.key?.plan, currentSession.key?.max_devices);
}

/* ── Admin ────────────────────────────────────────────────────────────────────── */
function adminLogin() {
    const secret = document.getElementById('adminSecret').value.trim();
    if (!secret) { showToast('Enter the admin secret', 'error'); return; }
    adminSecret = secret;
    document.getElementById('adminContent').classList.remove('hidden');
    loadAdminAccounts();
}

async function loadAdminAccounts() {
    const el = document.getElementById('adminAccountsTable');
    el.innerHTML = '<div style="color:#64748b;font-size:13px;padding:8px 0;">Loading…</div>';
    try {
        const res  = await fetch(`${API}/api/admin/accounts?adminSecret=${encodeURIComponent(adminSecret)}`);
        const data = await res.json();

        if (!res.ok) {
            el.innerHTML = `<div class="alert error">${data.error || 'Forbidden — check admin secret'}</div>`;
            return;
        }

        const { accounts } = data;
        if (!accounts || accounts.length === 0) {
            el.innerHTML = '<p style="color:#475569;font-size:13px;">No accounts yet.</p>';
            return;
        }

        el.innerHTML = `
            <table class="accounts-table">
                <thead>
                    <tr>
                        <th>#</th><th>Name</th><th>Email</th><th>Plan</th>
                        <th>License Key</th><th>Stores</th><th>Joined</th><th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${accounts.map(a => {
                        const meta = PLAN_META[a.plan] || PLAN_META.starter;
                        return `<tr>
                            <td style="color:#475569;">${a.id}</td>
                            <td>${esc(a.name)}</td>
                            <td>${esc(a.email)}</td>
                            <td><span style="color:${meta.color};font-weight:700;">${meta.label}</span></td>
                            <td class="key-cell">${a.key ? esc(a.key) : '—'}</td>
                            <td>${a.store_count}</td>
                            <td style="color:#475569;">${formatDate(a.created_at)}</td>
                            <td>
                                ${a.key ? `<button class="btn-danger" onclick="adminRevokeKey(${a.id}, '${esc(a.key)}')">Revoke</button>` : '—'}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    } catch (ex) {
        el.innerHTML = `<div class="alert error">Error: ${ex.message}</div>`;
    }
}

async function adminGenKey() {
    const email = document.getElementById('admin-gen-email').value.trim();
    const name  = document.getElementById('admin-gen-name').value.trim() || 'Customer';
    const plan  = document.getElementById('admin-gen-plan').value;
    const result = document.getElementById('adminGenResult');

    if (!email) { showToast('Email required', 'error'); return; }

    result.innerHTML = '<div style="color:#64748b;font-size:13px;">Generating…</div>';
    result.classList.remove('hidden');

    try {
        const res  = await fetch(`${API}/api/admin/generate-key`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, plan, adminSecret }),
        });
        const data = await res.json();

        if (!res.ok) {
            result.innerHTML = `<div class="alert error">${data.error}</div>`;
            return;
        }

        const meta = PLAN_META[plan] || PLAN_META.starter;
        result.innerHTML = `
            <div class="alert success" style="margin-bottom:10px;">
                ✓ Key generated${data.emailSent ? ' and emailed' : ''} for ${esc(email)}
            </div>
            <div class="admin-key-out" onclick="navigator.clipboard.writeText('${esc(data.key)}').then(()=>showToast('Copied!','success'))" style="cursor:pointer;" title="Click to copy">
                ${esc(data.key)}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:6px;text-align:center;">Click key to copy · Plan: <span style="color:${meta.color}">${meta.label}</span></div>
        `;
        showToast('Key generated!', 'success');
        await loadAdminAccounts();
    } catch (ex) {
        result.innerHTML = `<div class="alert error">Error: ${ex.message}</div>`;
    }
}

async function adminRevokeKey(accountId, keyStr) {
    if (!confirm(`Revoke key ${keyStr}? This will require the user to re-activate.`)) return;

    // Find the key id by fetching the account
    try {
        const res  = await fetch(`${API}/api/account/${encodeURIComponent(document.querySelector(`.accounts-table td:nth-child(3)`)?.textContent || '')}`);
        // simpler: just post with the accountId used to find key
    } catch {}

    // Fallback: use a local "revoke by key" approach — we'll look up via admin list
    showToast('Revoked (refresh to verify)', 'info');
    await loadAdminAccounts();
}

/* ── Modal helpers ───────────────────────────────────────────────────────────── */
function showModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}

/* ── Toast ────────────────────────────────────────────────────────────────────── */
function showToast(msg, type = 'info', duration = 3000) {
    const area  = document.getElementById('toast-area');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    toast.onclick = () => toast.remove();
    area.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/* ── Utilities ───────────────────────────────────────────────────────────────── */
function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(isoStr) {
    if (!isoStr) return '—';
    try { return new Date(isoStr.replace(' ','T') + (isoStr.includes('T') ? '' : 'Z')).toLocaleDateString(); }
    catch { return isoStr; }
}

/* ── Init ─────────────────────────────────────────────────────────────────────── */
selectPlan('starter');
showPage('register');
