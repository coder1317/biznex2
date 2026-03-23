# Biznex2 Deployment & Packaging Guide

This guide covers how to build and prepare Biznex2 for distribution on Windows and Raspberry Pi.

## 🏗️ Building Biznex2

### Prerequisites
- Node.js 18+ (LTS)
- npm 9+
- Git (optional)

### Windows Deployment

#### Option 1: Using electron-builder (Recommended for distribution)

```bash
# Install dependencies
npm install

# Build Windows installer (.exe)
npm run build:win

# Output location: ./biznex2-dist/
# - Biznex2-BOS-Setup-2.0.0.exe - Installer for end users
# - BOS-2.0.0.exe - Portable executable
```

#### Option 2: Development Build

```bash
npm install
npm start
# App runs directly from source
```

#### Option 3: Package as Portable Zip

```bash
npm run pack
# Creates ./biznex2-dist/biznex2-win-unpacked/
# Compress to .zip for distribution
```

### Raspberry Pi Deployment

#### Option 1: Install Script (Recommended)

```bash
# On Raspberry Pi:
sudo bash scripts/install.sh

# Or from remote:
ssh pi@raspberrypi.local 'bash -s' < rpi/install.sh
```

#### Option 2: Create SD Card Image

```bash
# On development machine:
npm run build:rpi
npm run package:rpi

# Creates portable package for distribution
```

#### Option 3: Docker Container (Optional)

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:18-bullseye

WORKDIR /app
COPY . .

RUN npm install --production

EXPOSE 3000

CMD ["node", "server/server-rpi.js"]
```

Build and run:
```bash
docker build -t biznex2:latest .
docker run -p 3000:3000 -v biznex2-data:/root/.biznex2 biznex2:latest
```

## 📦 Distribution Packages

### Windows Package Contents

**For End Users:**
```
Biznex2-Setup-2.0.0.exe
└─ Installs to: C:\Program Files\Biznex2\
```

**Inside the installer:**
- Complete Node.js runtime
- All dependencies
- Desktop shortcuts
- Registry entries for easy uninstall

### Raspberry Pi Package Contents

```
biznex2-rpi-2.0.0.tar.gz
├── rpi/install.sh
├── server/
├── client/
├── package.json
└── README.md
```

**To distribute:**
```bash
tar -czf biznex2-rpi-2.0.0.tar.gz biznex2/
# Upload to download server
scp biznex2-rpi-2.0.0.tar.gz user@server.com:/var/www/html/
```

## 🔐 Pre-Deploy Checklist

- [ ] Version number updated in package.json
- [ ] README.md reviewed and up-to-date
- [ ] QUICK_START.md reviewed
- [ ] .env.example includes all variables
- [ ] Database migrations tested
- [ ] API tests pass
- [ ] No debug code in production files
- [ ] All sensitive data removed
- [ ] License information current
- [ ] Build files verified for viruses
- [ ] Installation scripts tested on clean systems

## 🚀 Deployment Steps

### Step 1: Prepare Code

```bash
# Update version
npm version minor
# Commit changes
git add -A
git commit -m "v2.0.1 - Release"
git tag v2.0.1
```

### Step 2: Build

**Windows:**
```bash
npm run build:win
# Output: ./biznex2-dist/Biznex2-Setup-2.0.1.exe
```

**Raspberry Pi:**
```bash
npm run build:rpi
# Output: ./biznex2-dist/biznex2-rpi-2.0.1.tar.gz
```

### Step 3: Test Installation

**Windows:**
- Install on clean Windows 10/11 VM
- Verify all features work
- Test uninstall and reinstall

**Raspberry Pi:**
- Fresh Raspberry Pi OS image
- Run install script
- Test app access from network
- Verify PM2 auto-restart works

### Step 4: Package for Distribution

```bash
# Create release archive
mkdir -p releases/v2.0.1
cp biznex2-dist/Biznex2-Setup-2.0.1.exe releases/v2.0.1/
cd releases/v2.0.1
# Create checksums
sha256sum * > checksums.txt
cd ../..

# For Pi: package source code
tar -czf releases/v2.0.1/biznex2-rpi-2.0.1.tar.gz \
    --exclude=node_modules \
    --exclude=logs \
    --exclude=.env \
    biznex2/
```

### Step 5: Create Release Notes

Create `releases/v2.0.1/RELEASE_NOTES.md`:

```markdown
# Biznex2 v2.0.1

## What's New
- Feature 1
- Feature 2
- Bug fix 1

## Installation
- Windows: Run Biznex2-Setup-2.0.1.exe
- Raspberry Pi: bash rpi/install.sh

## Migration
If upgrading from v2.0.0:
- Backup your data first
- Uninstall previous version
- Install new version
- Database will auto-update
```

### Step 6: Deploy

**For Website Download:**
```bash
scp releases/v2.0.1/* user@website.com:/var/www/downloads/
```

**For GitHub Release:**
```bash
gh release create v2.0.1 \
    releases/v2.0.1/Biznex2-Setup-2.0.1.exe \
    releases/v2.0.1/biznex2-rpi-2.0.1.tar.gz \
    releases/v2.0.1/RELEASE_NOTES.md \
    --notes-file releases/v2.0.1/RELEASE_NOTES.md
```

## 📈 Post-Deployment

### Monitor
- Check crash reports
- Monitor error logs
- Track user feedback

### Update
- Bug fixes in v2.0.1-patch
- New features in v2.1.0
- Major refactors in v3.0.0

### Support
- Maintain documentation
- Provide installation support
- Handle troubleshooting

## 🔄 Automated Deployment (CI/CD)

### GitHub Actions Example

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build:win
      
      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          artifacts: biznex2-dist/*
```

## 📋 Version Management

```
v2.0.0 - Initial release
v2.0.1 - Bug fixes
v2.0.2 - More fixes
v2.1.0 - New features
v2.1.1 - Bug fixes for v2.1
v3.0.0 - Major rewrite
```

## 📞 Support

Post-deployment support includes:
- Installation troubleshooting
- Database recovery
- Multi-store setup guidance
- Performance optimization
- Security updates

---

**Remember**: Always test thoroughly on clean systems before distributing!
