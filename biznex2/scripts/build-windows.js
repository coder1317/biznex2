#!/usr/bin/env node

/**
 * Biznex2 Windows Build Script
 * 
 * Builds a distributable Windows installer (.exe)
 * 
 * Usage: node scripts/build-windows.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('  🏗️  BIZNEX2 WINDOWS INSTALLER BUILD');
console.log('='.repeat(60) + '\n');

// Check Node version
const nodeVersion = process.version;
console.log(`✅ Node.js ${nodeVersion}`);

// Check if we're on Windows (recommended for signing, but can build on any OS)
if (process.platform !== 'win32') {
    console.log('⚠️  Note: You\'re building on a non-Windows system.');
    console.log('   Windows builds are typically best done on Windows.');
    console.log('   Continuing anyway...\n');
}

// Check dependencies
console.log('📦 Checking dependencies...\n');

try {
    execSync('npm list electron-builder', { stdio: 'ignore' });
    console.log('✅ electron-builder installed');
} catch (e) {
    console.error('❌ electron-builder not found. Installing...');
    execSync('npm install', { stdio: 'inherit' });
}

try {
    execSync('npm list electron', { stdio: 'ignore' });
    console.log('✅ electron installed');
} catch (e) {
    console.error('❌ electron not found. Installing...');
    execSync('npm install', { stdio: 'inherit' });
}

console.log('\n🔨 Building Windows installer...\n');
console.log('This may take 2-5 minutes depending on your system...\n');

try {
    // Run the build command
    execSync('npm run build:win', { stdio: 'inherit' });
    
    console.log('\n' + '='.repeat(60));
    console.log('  ✅ BUILD COMPLETE!');
    console.log('='.repeat(60) + '\n');
    
    // Find the built files
    const distDir = path.join(__dirname, '..', 'biznex2-dist');
    
    if (fs.existsSync(distDir)) {
        console.log('📁 Output Directory: ' + distDir + '\n');
        
        // List the files created
        console.log('📦 Created Files:\n');
        
        const files = fs.readdirSync(distDir);
        let installerFound = false;
        let portableFound = false;
        
        files.forEach(file => {
            if (file.endsWith('.exe')) {
                console.log('  ✅ ' + file);
                if (file.includes('Setup')) {
                    installerFound = true;
                }
                if (file.includes('Setup')) {
                    portableFound = true;
                }
            }
            if (file.endsWith('.yml') || file.endsWith('.yaml')) {
                console.log('  📄 ' + file);
            }
        });
        
        console.log('\n📋 Next Steps:\n');
        console.log('1. 📥 Share the .exe file with users');
        console.log('2. 🔒 (Optional) Sign the executable for trusted distribution');
        console.log('3. 📤 Upload to your download server');
        console.log('4. 📢 Share download link with customers\n');
        
        console.log('📖 Installation Instructions for Users:\n');
        console.log('  1. Download the .exe file');
        console.log('  2. Double-click to run the installer');
        console.log('  3. Follow the installation wizard');
        console.log('  4. Click "Finish"');
        console.log('  5. Biznex2 will start automatically\n');
        
        console.log('💾 Installation Details:\n');
        console.log('  Location: C:\\Program Files\\Biznex2\\');
        console.log('  Data Storage: %APPDATA%\\Local\\Biznex2\\');
        console.log('  Database: biznex2.db (auto-created)');
        console.log('  Uninstall: Control Panel → Programs → Programs and Features\n');
        
    } else {
        console.log('⚠️  Distribution directory not found at: ' + distDir);
    }
    
    console.log('🎉 Your Windows installer is ready for distribution!\n');
    
} catch (error) {
    console.error('\n❌ Build failed!\n');
    console.error('Error:', error.message);
    console.log('\n🔧 Troubleshooting:\n');
    console.log('1. Ensure all dependencies are installed: npm install');
    console.log('2. Check that Node.js is properly installed');
    console.log('3. Try deleting node_modules and reinstalling: rm -r node_modules && npm install');
    console.log('4. Make sure you have enough disk space (~500MB)\n');
    process.exit(1);
}
