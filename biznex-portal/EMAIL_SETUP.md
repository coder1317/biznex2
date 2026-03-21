# Biznex Portal — Email Configuration Guide

## Overview

The Biznex Portal uses SMTP to send:
- **Verification codes** (OTP) during registration and login
- **License keys** to customers after purchase
- **Credential notifications** when account settings change

If SMTP is not configured, the portal will work in **Development Mode** — verification codes will be displayed on-screen.

---

## Gmail Setup (Recommended)

### Step 1: Enable 2-Factor Authentication

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click **Security** (left sidebar)
3. Scroll to "2-Step Verification"
4. Follow the prompts to enable it

### Step 2: Create an App Password

1. Return to Google Account → **Security**
2. Find **App passwords** (only appears if 2FA is enabled)
3. **Device**: Select "Mail"
4. **OS**: Select "Windows" (or your OS)
5. Google generates a **16-character password** — copy it
6. Do NOT use your actual Gmail password

### Step 3: Update `.env`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=Biznex Portal <your-gmail@gmail.com>
```

### Step 4: Restart

```bash
npm start
# or
node server.js
```

---

## Office 365 / Microsoft 365 Setup

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
SMTP_FROM=Biznex Portal <your-email@company.com>
```

---

## Generic SMTP Server

```env
SMTP_HOST=mail.your-host.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_FROM=Biznex Portal <noreply@your-domain>
```

---

## Troubleshooting

### "Email could not be sent"

1. Check `.env` is in the correct location: `biznex-portal/.env`
2. Verify credentials in `.env`
3. For Gmail:
   - Confirm you created an **app password** (not your login password)
   - 2FA must be enabled
   - The app password must be the 16-character version without spaces
4. Check firewall/network — SMTP port 587 must be open
5. Review logs:
   ```bash
   tail -f logs/portal.log
   ```

### DevCode showing in production

This means SMTP is not configured. The portal is displaying codes on-screen for testing.

**For production**: Set SMTP credentials **before** deploying.

### No emails received

1. Check **Spam** folder
2. Verify `SMTP_FROM` matches your email domain
3. Wait up to 5 minutes (some servers are slow)

---

## Testing Email

### Manual Test

```bash
curl -X POST http://localhost:5000/api/send-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","plan":"starter"}'
```

### Development Mode (No SMTP)

If SMTP is not set, the response includes `devCode`:

```json
{
  "sent": false,
  "devCode": "123456",
  "message": "Dev Mode: Use the code below to continue."
}
```

---

## Production Checklist

- [ ] SMTP credentials set in `.env`
- [ ] `.env` is NOT in version control (.gitignore)
- [ ] Test email sending before going live
- [ ] Restart portal after changing `.env`
- [ ] Monitor logs for SMTP errors in first 24h
- [ ] Configure firewall to allow outbound SMTP (port 587)

---

## Environment Variables Reference

| Variable | Required | Example |
|----------|----------|---------|
| `SMTP_HOST` | Yes | `smtp.gmail.com` |
| `SMTP_PORT` | Yes | `587` |
| `SMTP_USER` | Yes | `your-email@gmail.com` |
| `SMTP_PASS` | Yes | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | No | `Biznex <noreply@domain.com>` |
| `NODE_ENV` | No | `production` |
| `PORT` | No | `5000` |
| `ADMIN_SECRET` | Yes | `biznex-admin-2026` |

---

## Need Help?

- Portal logs: Check the `/logs` directory
- Check `.env` syntax — each env var must be on its own line
- SMTP credentials must be exact — no extra spaces
- For Office 365/Exchange, check MFA is not blocking app access
