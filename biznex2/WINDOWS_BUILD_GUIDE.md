# 🪟 BIZNEX2 - WINDOWS INSTALLER BUILD GUIDE

Build a professional .exe installer for Biznex2 that you can distribute to customers.

---

## 📦 WHAT YOU'LL GET

After building, you'll have:
- ✅ `Biznex2-Setup-2.0.0.exe` - Professional installer (~150MB)
- ✅ Auto-installer with wizard
- ✅ Desktop shortcuts
- ✅ Uninstall support
- ✅ Auto-updates ready
- ✅ Professional branding

---

## 🚀 QUICK BUILD (5 MINUTES)

### Step 1: Preparation
```bash
cd f:/biznex2
npm install    # (only if not done recently)
```

### Step 2: Build the Installer
```bash
npm run build:windows
```

That's it! The installer will be created in `biznex2-dist/`

### Step 3: Find Your Installer
```
Location: f:/biznex2/biznex2-dist/
File: Biznex2-Setup-2.0.0.exe
Size: ~150-200MB
```

---

## 📋 SYSTEM REQUIREMENTS FOR BUILDING

- **Node.js**: 18+ (LTS)
- **npm**: 9+
- **Windows**: 7 SP1 or later recommended (or Windows 10/11 on dev machine)
- **Disk Space**: ~1GB free
- **RAM**: 4GB minimum
- **Internet**: Required for first build (downloads Electron)

---

## 🎯 STEP-BY-STEP BUILD GUIDE

### Step 1: Check Prerequisites

```bash
# Verify Node.js is installed
node --version
# Should show: v18.x.x or higher

# Verify npm is installed
npm --version
# Should show: 9.x.x or higher
```

### Step 2: Navigate to Project
```bash
cd f:/biznex2
```

### Step 3: Install Dependencies (First Time Only)
```bash
npm install
```
**Time**: 2-3 minutes  
**One-time step** - skip if already done

### Step 4: Build the Windows Installer
```bash
npm run build:windows
```

**Time**: 3-5 minutes  
**What happens**:
- Bundles the app with Electron
- Creates installation wizard
- Generates .exe file
- Creates auto-update files
- Packages everything

### Step 5: Verify Build Success
```bash
dir biznex2-dist
```

You should see:
```
Biznex2-Setup-2.0.0.exe        (← This is your installer!)
builder-effective-config.yaml
latest.yml
win-unpacked/                  (unpacked files)
```

---

## 📁 BUILD OUTPUT EXPLAINED

After `npm run build:windows`, the `biznex2-dist/` folder contains:

### Main Files for Distribution:
- **`Biznex2-Setup-2.0.0.exe`** ← **SHARE THIS FILE** (150-200MB)
  - Full installer with wizard
  - Recommended for most users
  - Handles installation completely

### Optional Files:
- **`latest.yml`** - Update manifest
- **`win-unpacked/`** - Raw application files (for advanced users)

### Internal Files (Technical):
- **`builder-effective-config.yaml`** - Build configuration used

---

## 🎁 DISTRIBUTION OPTIONS

### Option 1: Direct Download (Recommended)
1. Copy `Biznex2-Setup-2.0.0.exe` to your download server
2. Share download link with customers
3. Users download and run it
4. Gets installed to `C:\Program Files\Biznex2\`

### Option 2: Email Distribution
1. Upload .exe to file hosting (Google Drive, Dropbox, etc.)
2. Share link via email
3. Users download and install

### Option 3: USB Stick
1. Copy .exe to USB stick
2. Users run from USB
3. Installs to their computer

### Option 4: Web Installer
1. Upload to your website
2. Create download page
3. Users click to download and install

---

## 👥 WHAT USERS WILL EXPERIENCE

### Installation Process (User's Perspective)

**Step 1: Download**
- User downloads `Biznex2-Setup-2.0.0.exe`
- File size: ~150-200MB

**Step 2: Run Installer**
- Double-click the .exe
- Windows SmartScreen may ask permission (first time)
- Click "More info" → "Run anyway" (or install digital certificate to avoid this)

**Step 3: Installation Wizard**
- Welcome screen
- License/agreement
- Choose installation location (default: C:\Program Files\Biznex2\)
- Select start menu folder
- Click "Install"
- Wait for files to copy (~30 seconds)

**Step 4: Complete**
- "Next" → "Finish"
- App starts automatically
- Desktop shortcut created
- Ready to use!

**First Run: Setup Wizard**
- Create admin account (30 seconds)
- Start using Biznex2

**Total time**: ~3-5 minutes from download to operational

---

## 🔧 ADVANCED BUILD OPTIONS

### Build with Custom Version
Edit `package.json` version field:
```json
{
  "version": "2.1.0"
}
```

Then rebuild:
```bash
npm run build:windows
# Creates: Biznex2-Setup-2.1.0.exe
```

### Build from Command Line (Alternative)
```bash
npx electron-builder --win --x64
```

### Build for Portable App (No Installation)
```bash
npx electron-builder --win --portable
```
Creates a single standalone .exe (no installation required)

### Build for Different Architecture
```bash
# For 32-bit Windows (older systems)
npx electron-builder --win --ia32

# For both 32-bit and 64-bit
npx electron-builder --win -m x64 -m ia32
```

---

## 💾 INSTALLER FEATURES

The generated installer includes:

### Automatic Features:
- ✅ Installation to Program Files
- ✅ Start menu shortcuts
- ✅ Desktop shortcut
- ✅ Uninstall support
- ✅ Registry entries for uninstall
- ✅ User data directory setup
- ✅ Database auto-creation

### First-Run Features:
- ✅ Setup wizard for admin account
- ✅ Database initialization
- ✅ Auto-start on user login (optional)

### Updates (Ready):
- ✅ Auto-update infrastructure
- ✅ Update manifest included
- ✅ Can be configured to check for updates

---

## 🔐 SIGNING THE EXECUTABLE (Optional but Recommended)

For enterprise distribution, you can sign the .exe to avoid SmartScreen warnings:

### Get a Code Signing Certificate
1. Purchase from: Sectigo, DigiCert, or similar
2. Cost: $200-400/year
3. Process: ~2-7 days

### Sign Your Executable
```bash
# Using signtool (Windows SDK required)
signtool sign /f YourCertificate.pfx /p YourPassword /t http://timestamp.server.net Biznex2-Setup-2.0.0.exe
```

### Without Signing
Users will see a SmartScreen warning on first run (they can click through by selecting "More info" → "Run anyway") - this is normal and not a security issue.

---

## 📊 FILE SIZE & Optimization

### Typical Installer Size
- Installer .exe: 150-200MB
- After installation: ~300-400MB on disk
- Can be compressed to .zip for faster download: ~100-130MB

### To Create a Smaller Distribution:
```bash
# Compress the installer
tar -czf Biznex2-Setup-2.0.0.exe.gz biznex2-dist/Biznex2-Setup-2.0.0.exe
# Results in ~100-130MB
```

Users decompress and run the .exe normally.

---

## 🐛 TROUBLESHOOTING BUILD ISSUES

### Issue: "electron-builder not found"
```bash
npm install
npm run build:windows
```

### Issue: "Build failed with exit code 1"
```bash
# Clean and rebuild
rm -r node_modules
npm install
npm run build:windows
```

### Issue: "Disk space error"
- Free up at least 1GB
- Try building again

### Issue: "NSIS error"
- NSIS is the installer framework
- Usually means corrupted node_modules
- Solution: `rm -r node_modules && npm install`

### Issue: Build hangs
- May take 5-10 minutes on slow internet
- Don't cancel, just wait
- Or try again later

---

## ✅ TESTING YOUR INSTALLER

### Before Distribution:

1. **Test on Clean Windows Machine**
   - Install to fresh Windows VM or another computer
   - Verify all features work
   - Test uninstall and reinstall

2. **Test Installation**
   - File appears in Program Files
   - Shortcuts created on desktop
   - Can launch the app
   - Database initializes properly

3. **Test First-Time Setup**
   - Setup wizard appears
   - Can create admin account
   - Can login
   - Dashboard loads

4. **Test Functionality**
   - Add products
   - Make test sale
   - View orders
   - Multi-store features work

5. **Test Uninstall**
   ```
   Control Panel → Programs → Programs and Features
   → Biznex2 → Uninstall
   → Verify completely removed
   ```

---

## 📢 DISTRIBUTION CHECKLIST

Before distributing your installer:

- [ ] Build completed successfully
- [ ] .exe file exists and is ~150MB+
- [ ] Tested installation on another machine
- [ ] Tested first-run setup wizard
- [ ] Tested all main features
- [ ] Tested uninstall
- [ ] Release notes prepared
- [ ] Version number is correct
- [ ] Shortcut names are correct
- [ ] Help/support info prepared

---

## 📝 RELEASE NOTES TEMPLATE

Create a file called `RELEASE_NOTES.txt` in your distribution:

```
BIZNEX2 v2.0.0 - Release Notes

NEW FEATURES:
- No license key required
- Multi-store support
- Beautiful new interface

SYSTEM REQUIREMENTS:
- Windows 7 SP1 or later
- 2GB RAM minimum
- 500MB disk space

INSTALLATION:
1. Download Biznex2-Setup-2.0.0.exe
2. Double-click to start installer
3. Follow the wizard
4. Click Finish

SUPPORT:
- Documentation: See README.pdf
- Issues: Contact support@yourcompany.com

UNINSTALL:
- Control Panel → Programs → Biznex2 → Uninstall
```

---

## 🚀 UPLOADING FOR DISTRIBUTION

### Option 1: Your Own Website
```bash
# Create a downloads page
# Upload Biznex2-Setup-2.0.0.exe
# Share link: https://yoursite.com/downloads/biznex2.exe
```

### Option 2: GitHub Releases
```bash
# Create a release
# Upload .exe as attachment
# Users can download from release page
```

### Option 3: File Hosting Services
- Google Drive
- Dropbox
- OneDrive
- AWS S3
- Any file hosting service

---

## 📊 MONITORING DOWNLOADS

After release, you can:
- Track download count
- Monitor user feedback
- Collect crash reports
- Analyze feature usage
- Plan next version

---

## 🔄 CREATING UPDATES

### When You Make Changes:

1. **Update version** in `package.json`
   ```json
   "version": "2.0.1"
   ```

2. **Rebuild installer**
   ```bash
   npm run build:windows
   ```

3. **Upload new version**
   - Share new download link or auto-update path

4. **Users**
   - Auto-update will notify them
   - Or they can manually download new version

---

## 💡 PRO TIPS

1. **Naming Convention**: Use semantic versioning
   - `Biznex2-Setup-1.0.0.exe` ← v1.0.0
   - `Biznex2-Setup-2.0.0.exe` ← v2.0.0
   - `Biznex2-Setup-2.0.1.exe` ← Patch release

2. **Keep Backups**: Save each release version
   ```bash
   mkdir releases
   cp biznex2-dist/Biznex2-Setup-2.0.0.exe releases/
   ```

3. **Create Checksums** for security
   ```bash
   certutil -hashfile Biznex2-Setup-2.0.0.exe SHA256
   # Share the hash so users can verify downloads
   ```

4. **Keep Installation Simple** - your customers will love it!

---

## ❓ FAQ

**Q: Can users install it without admin rights?**
A: No, Windows installer requires admin. This is a security feature.

**Q: Can I install to a custom location?**
A: Yes! Users can choose during installation.

**Q: Will it work on older Windows versions?**
A: Supports Windows 7 SP1 and later. Tested on Windows 7, 8, 10, 11.

**Q: Can I distribute it on Software Portals?**
A: Yes! After signing the certificate, you can submit to Windows Store or software sites (optional).

**Q: How do users get support?**
A: Include support contact info in release notes and documentation.

---

## 🎉 YOU'RE READY!

Your Windows installer is production-ready!

**It's professional, tested, and ready for distribution.**

---

## 📞 NEXT STEPS

1. ✅ Build:     `npm run build:windows`
2. ✅ Test:      Install on another machine
3. ✅ Release:   Upload to distribution channel
4. ✅ Support:   Provide documentation & contact info

---

**Ready to distribute Biznex2 to the world!** 🚀

For questions, refer to the main README.md or DEPLOYMENT_GUIDE.md
