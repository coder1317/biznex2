#!/usr/bin/env node

/**
 * Biznex2 Setup Verification Script
 * 
 * Checks that everything is ready for the demo
 * Usage: node scripts/verify-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Biznex2 Setup Verification\n');
console.log('=' .repeat(50));

let allChecks = true;

// Helper function
function check(name, condition) {
    const status = condition ? '✅' : '❌';
    console.log(`${status} ${name}`);
    if (!condition) allChecks = false;
    return condition;
}

// 1. Check package.json
console.log('\n📦 Package & Dependencies');
check('package.json exists', fs.existsSync(path.join(__dirname, '..', 'package.json')));
check('node_modules exists', fs.existsSync(path.join(__dirname, '..', 'node_modules')));

// 2. Check main files
console.log('\n📁 Project Structure');
check('Server exists', fs.existsSync(path.join(__dirname, '..', 'server', 'server.js')));
check('Client exists', fs.existsSync(path.join(__dirname, '..', 'client', 'index.html')));
check('Database module exists', fs.existsSync(path.join(__dirname, '..', 'server', 'db.js')));
check('Electron shell exists', fs.existsSync(path.join(__dirname, '..', 'electron-shell', 'main.js')));

// 3. Check documentation
console.log('\n📚 Documentation');
check('README.md exists', fs.existsSync(path.join(__dirname, '..', 'README.md')));
check('QUICK_START.md exists', fs.existsSync(path.join(__dirname, '..', 'QUICK_START.md')));
check('DEMO_TOMORROW.md exists', fs.existsSync(path.join(__dirname, '..', 'DEMO_TOMORROW.md')));
check('DEPLOYMENT_GUIDE.md exists', fs.existsSync(path.join(__dirname, '..', 'DEPLOYMENT_GUIDE.md')));
check('ARCHITECTURE.md exists', fs.existsSync(path.join(__dirname, '..', 'ARCHITECTURE.md')));

// 4. Check Raspberry Pi files
console.log('\n🍓 Raspberry Pi Support');
check('RPi install script exists', fs.existsSync(path.join(__dirname, '..', 'rpi', 'install.sh')));
check('RPi uninstall script exists', fs.existsSync(path.join(__dirname, '..', 'rpi', 'uninstall.sh')));
check('Server RPi variant exists', fs.existsSync(path.join(__dirname, '..', 'server', 'server-rpi.js')));

// 5. Check scripts
console.log('\n🔧 Scripts');
check('Windows installer script exists', fs.existsSync(path.join(__dirname, 'install-windows.bat')));
check('Demo data generator exists', fs.existsSync(path.join(__dirname, 'generate-demo-data.js')));
check('This verification script exists', fs.existsSync(path.join(__dirname, 'verify-setup.js')));

// 6. Check client assets
console.log('\n🎨 Client Assets');
check('HTML file exists', fs.existsSync(path.join(__dirname, '..', 'client', 'index.html')));
check('CSS file exists', fs.existsSync(path.join(__dirname, '..', 'client', 'style.css')));
check('JavaScript app file exists', fs.existsSync(path.join(__dirname, '..', 'client', 'app.js')));

// 7. Check configuration
console.log('\n⚙️  Configuration');
check('.env.example exists', fs.existsSync(path.join(__dirname, '..', '.env.example')));
check('.gitignore exists', fs.existsSync(path.join(__dirname, '..', '.gitignore')));

// 8. Summary
console.log('\n' + '='.repeat(50));

if (allChecks) {
    console.log('✅ All checks passed! You\'re ready for the demo!\n');
    console.log('📋 Next steps:');
    console.log('  1. npm install (if not done already)');
    console.log('  2. npm run demo-data (to load sample products)');
    console.log('  3. npm start (to run the app)');
    console.log('  4. Open http://localhost:3000 in your browser');
    console.log('  5. Complete the setup wizard\n');
    process.exit(0);
} else {
    console.log('❌ Some checks failed. Please verify the project structure.\n');
    process.exit(1);
}
