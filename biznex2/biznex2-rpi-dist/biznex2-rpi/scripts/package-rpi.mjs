#!/usr/bin/env node

/**
 * Biznex2 Raspberry Pi Package Builder
 * Creates a ready-to-deploy tarball for Raspberry Pi installation
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, "..");
const buildDir = path.join(projectRoot, "biznex2-rpi-dist");
const packageName = `biznex2-rpi-2.0.0.tar.gz`;

console.log("\n");
console.log("============================================================");
console.log("  📦 BIZNEX2 RASPBERRY PI PACKAGE BUILDER");
console.log("============================================================\n");

try {
    // Clean and create build directory
    if (fs.existsSync(buildDir)) {
        execSync(`rmdir /s /q "${buildDir}"`, { stdio: "inherit" });
    }
    fs.mkdirSync(buildDir, { recursive: true });

    // Create package structure
    const piDir = path.join(buildDir, "biznex2-rpi");
    fs.mkdirSync(piDir, { recursive: true });

    console.log("📂 Creating package structure...");

    // Copy core files
    const filesToCopy = [
        "package.json",
        "package-lock.json",
        ".env.example",
        ".gitignore",
        "README.md",
        "QUICK_START.md",
        "DEMO_TOMORROW.md",
    ];

    for (const file of filesToCopy) {
        const src = path.join(projectRoot, file);
        const dest = path.join(piDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`  ✅ ${file}`);
        }
    }

    // Copy directories
    const dirsToCopy = ["server", "client", "rpi", "scripts"];
    for (const dir of dirsToCopy) {
        const src = path.join(projectRoot, dir);
        const dest = path.join(piDir, dir);
        if (fs.existsSync(src)) {
            execSync(`xcopy "${src}" "${dest}" /E /I /Y`, { stdio: "ignore" });
            console.log(`  ✅ ${dir}/`);
        }
    }

    // Create install guide
    const installGuide = `# Biznex2 Raspberry Pi Installation

## Quick Start (2 minutes)

### 1. Extract the package
\`\`\`bash
tar -xzf biznex2-rpi-2.0.0.tar.gz
cd biznex2-rpi
\`\`\`

### 2. Run the installer
\`\`\`bash
chmod +x rpi/install.sh
./rpi/install.sh
\`\`\`

### 3. Access Biznex2
- **URL**: http://raspberrypi.local:3000 (or http://[PI_IP]:3000)
- **First Time**: Setup wizard will appear
- **Create Admin Credentials**: Username & Password (NO license key!)

## Detailed Installation

**Prerequisites**:
- Raspberry Pi OS (Bullseye or newer)
- SSH access enabled
- Internet connection

**Step-by-Step**:
1. \`tar -xzf biznex2-rpi-2.0.0.tar.gz && cd biznex2-rpi\`
2. \`sudo chmod +x rpi/install.sh && sudo ./rpi/install.sh\`
3. Wait for installation to complete (3-5 minutes)
4. Reboot: \`sudo reboot\`
5. Open browser: \`http://raspberrypi.local:3000\`

## Post-Installation

### Start/Stop Service
\`\`\`bash
pm2 stop biznex2          # Stop
pm2 start biznex2         # Start  
pm2 status                # Check status
pm2 logs biznex2          # View logs
\`\`\`

### Uninstall
\`\`\`bash
cd biznex2-rpi
sudo chmod +x rpi/uninstall.sh
sudo ./rpi/uninstall.sh
\`\`\`

### Load Demo Data
\`\`\`bash
npm run demo-data
\`\`\`

## Troubleshooting

**Can't access on network**: Check firewall, ensure Pi has static IP
**Service won't start**: Check logs: \`pm2 logs\`  
**Database errors**: Clear and reinitialize: \`npm run demo-data\`
**Port 3000 in use**: Change PORT env var in .env file

## Features

✅ Multi-store management  
✅ POS system with cart  
✅ Product inventory  
✅ Order history  
✅ Dashboard analytics  
✅ No license key required  
✅ First-time admin setup  

## Support

For issues or questions: https://github.com/coder1317/biznex2

---
**Version**: 2.0.0  
**Built**: $(date)  
**Ready for Raspberry Pi deployment**
`;

    fs.writeFileSync(
        path.join(piDir, "PI_INSTALLATION.md"),
        installGuide
    );
    console.log("  ✅ PI_INSTALLATION.md");

    // Create tar.gz using PowerShell compression
    console.log("\n🗜️  Compressing to zip...");
    
    // Use PowerShell to create zip instead
    const zipCommand = `Compress-Archive -Path "${path.join(buildDir, "biznex2-rpi")}" -DestinationPath "${path.join(buildDir, "biznex2-rpi-2.0.0.zip")}" -Force`;
    execSync(`powershell -Command "${zipCommand}"`, { stdio: "inherit" });

    const zipPath = path.join(buildDir, "biznex2-rpi-2.0.0.zip");
    const stats = fs.statSync(zipPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log("\n============================================================");
    console.log("  ✅ BUILD COMPLETE!");
    console.log("============================================================\n");
    console.log(`📦 Package: biznex2-rpi-2.0.0.zip`);
    console.log(`📍 Location: ${buildDir}`);
    console.log(`📊 Size: ${sizeMB} MB\n`);
    console.log("✅ Ready to distribute and install on Raspberry Pi!\n");

} catch (err) {
    console.error("\n❌ Build failed:", err.message);
    process.exit(1);
}
