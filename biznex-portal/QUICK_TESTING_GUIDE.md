# Biznex Portal — Quick Testing Guide

## 🎯 Quick Start

### Start the Portal
```bash
cd f:\biznex-portal
npm install  # if first time
npm start    
# Portal runs at http://localhost:5000
```

---

## ✅ Test Flows

### Test 1: Plan Selection ⭐

**Objective:** Verify plan selection works and persists

1. Load http://localhost:5000
2. You're on Register page
3. **Default state**: "Starter" plan should be selected (glowing border)
4. **Click "Business" card** → 
   - Card highlights with blue glow
   - Label changes to "Business" (blue text)
   - "Multi-Store allowed" should apply
5. **Click "Enterprise" card** →
   - Card highlights with green glow
   - Label changes to "Enterprise" (green text)
6. **Click "Login" button in top nav** →
   - Go to login page
7. **Click "Register" button in top nav** →
   - Return to register page
   - **✓ EXPECTED**: Enterprise still selected (persisted!)
   - Selection showed in subtitle: "Selected plan: **Enterprise**"

**Status**: ✅ PASS if plan persists

---

### Test 2: Email Verification (Dev Mode) 🔐

**Objective:** Test dev code display for email verification without SMTP

**Precondition**: SMTP not configured in `.env` (should be empty)

1. Load http://localhost:5000
2. Click "Register" button (if not already there)
3. **Select "Business" plan** (any plan works)
4. **Fill form:**
   - Name: `Test User Dev`
   - Email: `testdev@example.com`
5. **Click "Send Verification Code →"**
6. **Expected screen:**
   - Step indicator shows Step 2 active
   - Heading: "Verify Your Email"
   - **💡 Red dev code box appears** with:
     - Label: "Dev Mode — SMTP not configured"
     - Large 6-digit code (e.g., `425873`)
     - Hint: "Copy this code into the field below to continue"
7. **Click the code** →
   - Toast notification: "Dev code copied! Paste it below."
   - Code is in clipboard
8. **Click first OTP field**, then paste → 
   - All 6 boxes auto-fill
   - Last box gets focus
9. **Click "Verify & Generate Key →"**
10. **Result:**
    - ✅ Success page shows license key
    - ✅ Plan shows "Business Plan"
    - ✅ Key starts with `BZNX-BIZ-`

**Status**: ✅ PASS if dev code appears and verification works

---

### Test 3: Error Handling

**Test 3A: Empty Form**
1. Go to Register
2. Leave all fields empty
3. Click "Send Verification Code →"
4. **Expected**: "Please fill in all fields." error message
5. **Status**: ✅ PASS if validation works

**Test 3B: Email Already Registered**
1. Go to Register
2. Enter:
   - Name: `Duplicate Test`
   - Email: `testdev@example.com` (from Test 2)
   - Plan: Starter
3. Click "Send Verification Code →"
4. Go to Step 2 (dev code appears)
5. Copy and paste dev code
6. Click "Verify & Generate Key →"
7. **Expected**: "Email already registered." error
8. **Status**: ✅ PASS if duplicate detection works

**Test 3C: Wrong OTP Code**
1. Start fresh registration with new email
2. When dev code appears, intentionally enter wrong code (e.g., `000000`)
3. Click "Verify & Generate Key →"
4. **Expected**: "Incorrect code. Please try again." error
5. **Status**: ✅ PASS if validation works

---

### Test 4: Login Flow 👤

**Objective:** Test login with email verification

1. Go to Register
2. Complete registration with:
   - Name: `John Doe`
   - Email: `john@test.com`
   - (copy dev code when appears)
3. On Success page, note the credentials shown
4. **Go to Login page** (or come back later)
5. Enter email: `john@test.com`
6. Click "Send Code →"
7. **Dev code box appears** (if SMTP not configured)
8. Copy and paste code into OTP fields
9. Click "Verify & Sign In →"
10. **Expected:**
    - Dashboard loads
    - Sidebar shows "John Doe" and `john@test.com`
    - License key visible
    - Plan chip shows "Business" (whatever was selected)

**Status**: ✅ PASS if login works

---

### Test 5: Browser Console Debugging 🔧

**Objective:** Verify debug logging for dev mode

1. Open http://localhost:5000
2. Open Developer Tools: `F12` or `Ctrl+Shift+I`
3. Go to **Console** tab
4. Register with any plan and email
5. When dev code appears:
   - **Watch the console**
   - **Expected message**: `📋 Dev Code: 425873` (or whatever the code is)
6. **Status**: ✅ PASS if console log appears

---

## 📊 Test Results Checklist

| Feature | Status | Notes |
|---------|--------|-------|
| Plan selection works | ? | Highlight + color |
| Plan persists | ? | After navigate away |
| Dev code displays | ? | Red box appears |
| Dev code clickable | ? | Copies to clipboard |
| OTP auto-advance | ? | Type in first, goes to next |
| OTP paste works | ? | Paste 6 digits at once |
| Form validation | ? | No empty submissions |
| Error messages | ? | Clear and helpful |
| Duplicate email | ? | Shows "already registered" |
| Wrong OTP code | ? | Shows "incorrect code" |
| Login works | ? | Dashboard loads |
| Dashboard layout | ? | Sidebar + content |
| Console logging | ? | `📋 Dev Code:` message |
| Responsive design | ? | Works on mobile |
| Button states | ? | Disabled during submit |

---

## 🐛 Debug Tips

### If Dev Code Doesn't Appear:
1. **Check SMTP config**:
   - Go to `.env`
   - Verify SMTP_HOST is **empty** (for dev mode)
   - If filled, codes won't show (production mode)
2. **Check browser console**:
   - `F12` → Console tab
   - Look for any error messages
   - Dev code should be logged

### If OTP Entry Fails:
1. **Make sure you pasted the CORRECT 6 digits**
2. **Try typing slowly** into each box instead of pasting
3. **Check code hasn't expired** (10 minutes limit)
4. **Try a fresh registration** with new email

### If Login Doesn't Work:
1. **Make sure email exists** (already registered)
2. **Use the exact dev code** shown on screen
3. **Try registration flow first** (to create account)

### To View Registered Accounts:
1. Open SQLite database: `f:\biznex-portal\portal.db`
2. View `accounts` table
3. Check `license_keys` table for generated keys

---

## 🚀 Common Scenarios

### Scenario: Complete First-Time Registration
1. **Plan**: Select Business
2. **Email**: `myemail@company.com`
3. **Dev Code**: Copy from red box (click it)
4. **Paste**: Into OTP fields
5. **Result**: Key like `BZNX-BIZ-XXXX-XXXX`
6. **Dashboard**: Shows business plan with key

### Scenario: Multi-Plan Testing
1. Register with Starter → get STR key
2. Go back, select Business → register new email → get BIZ key
3. Try Enterprise → register new email → get ENT key
4. Compare keys (different prefixes: STR, BIZ, ENT)

### Scenario: Switching to Different Plans Later
**Note:** Current design doesn't support plan upgrades.
For now, register separate accounts for each plan level.

---

## 📱 Mobile Testing

If testing on phone/tablet:

1. Use `http://<your-pc-ip>:5000` (not localhost)
2. Find your PC's IP: `ipconfig` in terminal (look for IPv4)
3. Example: `http://192.168.1.100:5000`
4. Verify responsive layout works:
   - Plan cards stack vertically
   - OTP boxes visible
   - Buttons clickable
   - Text readable without zoom

---

## 💾 Reset Database (if needed)

Delete existing test data:
```bash
# Backup first
copy f:\biznex-portal\portal.db f:\biznex-portal\portal.db.backup

# Delete to start fresh (will recreate on next run)
del f:\biznex-portal\portal.db
del f:\biznex-portal\portal.db-shm
del f:\biznex-portal\portal.db-wal

# Restart server
npm start
```

---

## 🎓 What Each Component Does

### Frontend (public/)
- **app.js**: All UI logic, form handling, state management
- **index.html**: Page structure and form layout
- **style.css**: All styling (dark theme, responsive design)

### Backend (server.js)
- **send-verification**: Generates OTP and sends/displays email code
- **verify-code**: Validates OTP and creates account with license key
- **login**: Two-step login flow with OTP verification

### Database (portal.db - SQLite)
- **accounts**: User email, name, and portal login credentials
- **license_keys**: Generated keys, plan type, device limits
- **stores**: Store locations under each account (for Business+)

---

## ❓ FAQ

**Q: Where's my license key?**  
A: After verification, on the **Success page**. Copy or click "Copy" button.

**Q: I forgot my dev code number**  
A: Check the **red Dev Mode box** on screen, or look in **Browser Console** (`F12`).

**Q: Why does SMTP need to be empty?**  
A: When empty, dev mode shows codes on screen. When configured, codes go to email only (production).

**Q: Can I test on my phone?**  
A: Yes! Use `http://your-pc-ip:5000` instead of `localhost:5000`.

**Q: What if I can't see the dev code box?**  
A: SMTP is probably configured. Check `.env` and empty the SMTP fields.

---

## 📞 Next Steps

After testing locally:
1. ✅ Verify all flows work
2. ✅ Configure SMTP for real email (if sending to users)
3. ✅ Deploy to cloud hosting (Heroku, AWS, etc.)
4. ✅ Update license server URL if needed
5. ✅ Monitor license key activations in BOS app

---

Need help? Check **Console** (`F12`) for error messages! 🔍
