const { app, BrowserWindow, ipcMain, Menu } = require('electron');
Menu.setApplicationMenu(null);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

// ─── Path Management ───────────────────────────────────────────────────────
const userDataPath = app.getPath('userData');

// Load .env from userData if packaged, otherwise from project root
const envFile = app.isPackaged
    ? path.join(userDataPath, '.env')
    : path.join(__dirname, '..', '.env');

dotenv.config({ path: envFile });

// ─── Generate JWT Secrets on First Run ─────────────────────────────────────
if (app.isPackaged && !process.env.JWT_SECRET) {
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    const refreshSecret = crypto.randomBytes(64).toString('hex');
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;

    const secretsBlock = `\nJWT_SECRET=${jwtSecret}\nJWT_REFRESH_SECRET=${refreshSecret}\n`;
    try {
        fs.appendFileSync(envFile, secretsBlock, 'utf8');
        console.log('[main] Generated JWT secrets');
    } catch (e) {
        console.warn('[main] Could not write JWT secrets:', e.message);
    }
}

// ─── Redirect mutable files to userData in packaged mode ───────────────────
if (app.isPackaged) {
    process.env.DB_PATH = path.join(userDataPath, 'biznex2.db');
    if (!process.env.LOG_DIR) process.env.LOG_DIR = path.join(userDataPath, 'logs');
}

if (!process.env.API_BASE_URL) process.env.API_BASE_URL = 'http://localhost:3000';

// ─── Start the Express Server ──────────────────────────────────────────────
try {
    require(path.join(__dirname, '..', 'server', 'server'));
    console.log('[main] Express server started');
} catch (e) {
    console.error('[main] Express server failed:', e.message);
}

// ─── Create Electron Window ────────────────────────────────────────────────
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        },
        icon: path.join(__dirname, '..', 'build-assets', 'icon.png')
    });

    // Load app from local server
    mainWindow.loadURL('http://localhost:3000');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open DevTools in development
    // if (process.env.NODE_ENV === 'development') {
    //     mainWindow.webContents.openDevTools();
    // }
}

// ─── App Event Handlers ────────────────────────────────────────────────────
app.on('ready', () => {
    // Small delay to ensure server is ready
    setTimeout(() => {
        createWindow();
    }, 1000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// ─── IPC Handlers ──────────────────────────────────────────────────────────
ipcMain.on('get-user-data-path', (event) => {
    event.reply('user-data-path', userDataPath);
});

console.log('[main] Biznex2 Electron app initialized');
