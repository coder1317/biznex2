# Gmail SMTP Setup Guide

## Steps to Enable Email

### 1. Create an App-Specific Password

**Follow these steps:**

1. Go to https://myaccount.google.com
2. Click "Security" in the left sidebar
3. Scroll down and find "App passwords" (you may need to enable 2-Step Verification first)
4. Select:
   - **App**: Mail
   - **Device**: Windows Computer
5. Google will generate a 16-character password
6. Copy this password

### 2. Update the .env File

Replace `YOUR_APP_PASSWORD_HERE` in `.env` with the 16-character password you copied:

```
SMTP_PASS=xxxx xxxx xxxx xxxx
```

### 3. Restart the Portal

```bash
cd F:\biznex-portal
npm start
```

### 4. Test Email Sending

When you create an account, you should now receive verification emails at viktra18@gmail.com

---

## If You Don't See "App Passwords" Option

You need to enable 2-Step Verification first:

1. Go to https://myaccount.google.com
2. Click "Security"
3. Scroll to "How you sign in to Google"
4. Click "2-Step Verification"
5. Follow the prompts to enable it
6. Then go back and find "App passwords"

---

## Current Configuration

- **SMTP Host**: smtp.gmail.com
- **SMTP Port**: 587
- **From Email**: viktra18@gmail.com
- **Status**: Ready (waiting for app password)
