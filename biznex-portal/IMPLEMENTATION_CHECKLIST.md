# Biznex Portal — Implementation Checklist

## ✅ Backend Fixes (COMPLETED)

- [x] Fixed token validation in account creation
- [x] Added OTP memory cleanup routine
- [x] Updated .env with email setup instructions
- [x] Created EMAIL_SETUP.md guide
- [x] Created BUG_FIXES.md documentation

**Status**: All backend changes deployed and ready

---

## 🔧 Frontend Changes (REQUIRED)

### 1. Update Registration Flow

**File**: `client/src/pages/Register.js` (or similar)

**Current flow** (broken):
```javascript
// Step 1: Send verification
const sendCode = async (email, plan) => {
    const res = await fetch('/api/send-verification', {
        method: 'POST',
        body: JSON.stringify({ email, plan })
    });
    return res.json(); // { sent, devCode?, message }
};

// Step 2: Verify code
const verifyCode = async (email, code) => {
    const res = await fetch('/api/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code })
    });
    return res.json(); // { success, token?, message }
};

// Step 3: Create account (BUG: doesn't use token)
const createAccount = async (email, password, plan) => {
    return await fetch('/api/create-account', {
        method: 'POST',
        body: JSON.stringify({ email, password, plan })
        // ❌ Missing: token
    });
};
```

**Fixed flow**:
```javascript
let verificationToken = null; // Store token from step 2

// Step 1: Send verification (unchanged)
const sendCode = async (email, plan) => {
    const res = await fetch('/api/send-verification', {
        method: 'POST',
        body: JSON.stringify({ email, plan })
    });
    return res.json();
};

// Step 2: Verify code (save token)
const verifyCode = async (email, code) => {
    const res = await fetch('/api/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code })
    });
    const data = res.json();
    if (data.success) {
        verificationToken = data.token; // ✅ Save token
    }
    return data;
};

// Step 3: Create account (FIXED: pass token)
const createAccount = async (email, password, plan) => {
    if (!verificationToken) {
        throw new Error('Email not verified. Please verify first.');
    }
    return await fetch('/api/create-account', {
        method: 'POST',
        body: JSON.stringify({ 
            email, 
            password, 
            plan,
            token: verificationToken  // ✅ Now passing token
        })
    });
};
```

### 2. Update Form State

**Track**: `email`, `code`, `verificationToken`, `password`, `plan`

```javascript
const [state, setState] = useState({
    email: '',
    code: '',
    verificationToken: null, // ✅ New
    password: '',
    plan: 'starter',
    step: 1, // 1=send code, 2=verify code, 3=create account
});

// When verify succeeds:
setState(prev => ({
    ...prev,
    verificationToken: response.token, // ✅ Store it
    step: 3
}));

// When creating account:
const response = await fetch('/api/create-account', {
    method: 'POST',
    body: JSON.stringify({
        email: state.email,
        password: state.password,
        plan: state.plan,
        token: state.verificationToken  // ✅ Use it
    })
});
```

### 3. Error Handling

Add specific error messages for new failure cases:

```javascript
const createAccountResponse = await fetch('/api/create-account', ...);

if (!createAccountResponse.ok) {
    const error = await createAccountResponse.json();
    
    if (error.error.includes('token')) {
        // User's session expired
        showMessage('Your verification expired. Please start over.', 'error');
        setState(prev => ({ ...prev, step: 1, verificationToken: null }));
    } else if (error.error.includes('mismatch')) {
        // Email changed between verify and create
        showMessage('Email changed. Please verify again.', 'error');
        setState(prev => ({ ...prev, step: 2, verificationToken: null }));
    } else {
        showMessage(error.error, 'error');
    }
    return;
}
```

---

## 📋 Testing Checklist

- [ ] Test full registration flow end-to-end
- [ ] Test with code expiration (wait > 10 min)
- [ ] Test with wrong code
- [ ] Test with email change between steps
- [ ] Test account creation without verification
- [ ] Test in dev mode (no SMTP)
- [ ] Test with SMTP enabled
- [ ] Verify license key is generated

---

## 🚀 Deployment Steps

### Pre-Deployment

1. **Backup Database**
   ```bash
   cp biznex-portal/portal.db biznex-portal/portal.db.backup
   ```

2. **Update Frontend Code**
   - Apply changes from "Frontend Changes" section above
   - Test locally in dev mode

3. **Verify Backend**
   ```bash
   npm test  # If you have tests
   ```

### Deployment

1. **Stop Current Portal**
   ```bash
   npm stop
   # or
   kill $(lsof -t -i :5000)
   ```

2. **Pull Latest Code**
   ```bash
   git pull origin main
   ```

3. **Install Dependencies** (if needed)
   ```bash
   npm install
   ```

4. **Configure SMTP** (if not already done)
   ```bash
   # Edit .env
   # Add SMTP credentials
   ```

5. **Start Portal**
   ```bash
   npm start
   ```

6. **Verify Startup**
   ```bash
   # Check logs
   tail -f logs/portal.log
   # Should see: "[portal] SQLite schema ready"
   ```

### Post-Deployment

1. **Test Registration**
   - Create test account
   - Verify email code flow
   - Check license key generated

2. **Monitor Logs** (first hour)
   ```bash
   tail -f logs/portal.log
   ```

3. **Check OTP Cleanup**
   - Wait 5+ minutes
   - Should see: "[portal] Cleaned up X expired OTP entries"

4. **Load Testing**
   - Test multiple simultaneous registrations
   - Monitor memory usage

---

## 🆘 Troubleshooting

### Frontend Test: Verify Flow

```bash
# Test endpoint directly
curl -X POST http://localhost:5000/api/send-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","plan":"starter"}'

# Should return devCode in dev mode
```

### Account Creation Without Token (Should Fail)

```bash
curl -X POST http://localhost:5000/api/create-account \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","plan":"starter"}'

# Should return 400:
# {"error":"Email, password, and verification token are required."}
```

### Check Memory Cleanup

```bash
# Monitor otpStore size over time
grep "Cleaned up" logs/portal.log
```

---

## 📞 Support

If frontend changes are unclear:
1. See [BUG_FIXES.md](BUG_FIXES.md) for detailed API changes
2. See [EMAIL_SETUP.md](EMAIL_SETUP.md) for email configuration
3. Check curl examples in BUG_FIXES.md

---

## Files Changed

### Backend
- `biznex-portal/server.js` — Token validation + OTP cleanup
- `biznex-portal/.env` — Email setup instructions

### Documentation
- `biznex-portal/BUG_FIXES.md` — What was fixed
- `biznex-portal/EMAIL_SETUP.md` — Email configuration guide
- `[THIS FILE]` — Implementation checklist

### Frontend (TO DO)
- `client/src/pages/Register.js` — Update to use token
- `client/src/components/SignupForm.js` — Similar updates
- Any registration-related component

---

## Estimated Timeline

| Phase | Time | Status |
|-------|------|--------|
| Backend fixes | ✅ Done | Complete |
| Frontend updates | ⏳ In Progress | Estimated 2-4 hours |
| Local testing | ⏳ Pending | Estimated 1-2 hours |
| Staging deployment | ⏳ Pending | Estimated 30 min |
| Production deploy | ⏳ Pending | Estimated 15 min |

---

## Questions?

Refer to:
1. [BUG_FIXES.md](BUG_FIXES.md) — Technical details
2. [EMAIL_SETUP.md](EMAIL_SETUP.md) — Email configuration
3. Curl examples below

### Quick API Reference

```bash
# Send verification code
POST /api/send-verification
{ "email": "...", "plan": "starter" }

# Verify code and get token
POST /api/verify-code
{ "email": "...", "code": "..." }
→ Returns: { "token": "...", "success": true }

# Create account (NOW REQUIRES TOKEN)
POST /api/create-account
{ "email": "...", "password": "...", "token": "...", "plan": "starter" }
→ Returns: { "account": {...}, "key": "BZNX-..." }
```

---

**Last Updated**: 2025
**Version**: 1.0
