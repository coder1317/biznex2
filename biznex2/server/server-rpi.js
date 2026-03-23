// Biznex2 Server for Raspberry Pi (Kiosk/Headless Mode)
require('dotenv').config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Load the main server logic
const mainServer = require('./server');

// Serve static files from client
app.use(express.static(path.join(__dirname, '..', 'client')));

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
    }
});

console.log(`🍓 Biznex2 RPi Server ready at http://0.0.0.0:${PORT}`);

module.exports = app;
