# 📦 BUILD WINDOWS INSTALLER - QUICK START

Everything you need to create a downloadable Windows app for Biznex2.

## ⚡ 5-MINUTE BUILD

```bash
cd f:/biznex2
npm install              # (first time only - 2-3 min)
npm run build:windows    # (build installer - 3-5 min)
```

**Done!** Your installer is in: `f:/biznex2/biznex2-dist/Biznex2-Setup-2.0.0.exe`

---

## 📦 Share the .exe File

**File to distribute:**
- `Biznex2-Setup-2.0.0.exe` (~150-200MB)

**Users just need to:**
1. Download the .exe
2. Double-click it
3. Click through the wizard
4. Done!

---

## 📋 What Gets Installed

- ✅ Auto-installation to `C:\Program Files\Biznex2\`
- ✅ Desktop shortcuts
- ✅ Start menu entries
- ✅ Database directory in user's AppData
- ✅ Uninstall support (Add/Remove Programs)

---

## 🎯 Distribution Options

### Email Sharing
1. Upload .exe to Google Drive, Dropbox, or similar
2. Share link via email
3. Users download and install

### Website Download
1. Host .exe on your website
2. Share download link
3. Users download and install

### GitHub Release
1. Create a GitHub release
2. Upload .exe as attachment
3. Users download from release page

### USB Distribution
1. Copy .exe to USB stick
2. Users copy to their computer
3. Users run the installer

---

## 🐛 If Build Fails

**Most Common Fix:**
```bash
rm -r node_modules
npm install
npm run build:windows
```

**Other Options:**
- Ensure you have ~1GB free disk space
- Check internet connection (first build downloads Electron)
- Try again in a few minutes

---

## 📖 Full Guide

For complete build details, installer customization, and advanced options:

👉 **Read: `WINDOWS_BUILD_GUIDE.md`**

---

## 🎉 That's It!

Your Windows installer is ready to share!

**You now have a professional .exe that users can download and install.**
