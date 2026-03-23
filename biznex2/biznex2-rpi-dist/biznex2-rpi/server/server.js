require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const winston = require("winston");
const path = require("path");
const fs = require("fs");
const db = require("./db");

// ─── JWT Secrets Generation (First Run) ───────────────────────────────────
if (!process.env.JWT_SECRET) {
    const crypto = require('crypto');
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
    console.warn('[server] JWT_SECRET generated');
}
if (!process.env.JWT_REFRESH_SECRET) {
    const crypto = require('crypto');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(64).toString('hex');
}

// ─── Logger Setup ──────────────────────────────────────────────────────────
const logDir = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'biznex2-server' },
    transports: [
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

// ─── Express App Setup ──────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "http://localhost:*", "https://*", "ws://localhost:*", "wss://*"],
            fontSrc: ["'self'", "data:"],
        }
    }
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// ─── JWT Middleware ────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ─── API: First-Time Setup ────────────────────────────────────────────────
app.post('/api/setup/check', (req, res) => {
    db.get('SELECT is_setup_complete FROM system_settings', [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Setup check failed' });
        }
        res.json({ setupComplete: row ? row.is_setup_complete === 1 : false });
    });
});

app.post('/api/setup/initialize', async (req, res) => {
    const { username, email, password, storeName } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.get('SELECT is_setup_complete FROM system_settings', [], (err, row) => {
            if (row && row.is_setup_complete === 1) {
                return res.status(400).json({ error: 'Setup already completed' });
            }

            db.run(`
                INSERT OR REPLACE INTO system_settings 
                (id, app_name, is_setup_complete, admin_username, admin_email, admin_password_hash)
                VALUES (1, ?, 1, ?, ?, ?)
            `, [storeName || 'Biznex2', username, email || '', hashedPassword], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Setup failed: ' + err.message });
                }

                // Create admin user
                db.run(`
                    INSERT INTO users (store_id, username, email, password_hash, role)
                    VALUES (1, ?, ?, ?, 'admin')
                `, [username, email || '', hashedPassword], (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'User creation failed' });
                    }

                    const token = jwt.sign(
                        { id: 1, username, role: 'admin', storeId: 1 },
                        process.env.JWT_SECRET,
                        { expiresIn: '24h' }
                    );

                    res.json({ 
                        success: true,
                        message: 'Setup completed successfully',
                        token 
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Setup initialization failed: ' + error.message });
    }
});

// ─── API: Login ────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Login failed' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        try {
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role, storeId: user.store_id },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({ 
                success: true,
                token,
                user: { id: user.id, username: user.username, role: user.role }
            });
        } catch (error) {
            res.status(500).json({ error: 'Authentication failed' });
        }
    });
});

// ─── API: Products ────────────────────────────────────────────────────────
app.get('/api/products', authenticateToken, (req, res) => {
    const storeId = req.user.storeId || 1;
    db.all('SELECT * FROM products WHERE store_id = ? ORDER BY name', [storeId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch products' });
        }
        res.json(rows || []);
    });
});

app.post('/api/products', authenticateToken, (req, res) => {
    const { name, sku, price, costPrice, stock, category } = req.body;
    const storeId = req.user.storeId || 1;

    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price required' });
    }

    db.run(`
        INSERT INTO products (store_id, name, sku, price, cost_price, stock, category)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [storeId, name, sku || null, price, costPrice || 0, stock || 0, category || 'Uncategorized'], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to create product' });
        }
        res.json({ success: true, message: 'Product created' });
    });
});

// ─── API: Orders ──────────────────────────────────────────────────────────
app.get('/api/orders', authenticateToken, (req, res) => {
    const storeId = req.user.storeId || 1;
    db.all(`
        SELECT o.*, COUNT(oi.id) as item_count 
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.store_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `, [storeId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }
        res.json(rows || []);
    });
});

app.post('/api/orders', authenticateToken, (req, res) => {
    const { items, customerName, customerPhone, paymentMethod, total } = req.body;
    const storeId = req.user.storeId || 1;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Order must have items' });
    }

    const orderNo = 'ORD-' + Date.now();

    db.run(`
        INSERT INTO orders (store_id, order_no, customer_name, customer_phone, payment_method, total)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [storeId, orderNo, customerName || 'Walk-in', customerPhone || '', paymentMethod || 'cash', total], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to create order' });
        }

        db.get('SELECT last_insert_rowid() as id', [], (err, row) => {
            const orderId = row.id;

            // Insert order items
            let completed = 0;
            items.forEach(item => {
                db.run(`
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
                    VALUES (?, ?, ?, ?, ?)
                `, [orderId, item.productId, item.quantity, item.unitPrice, item.subtotal], (err) => {
                    completed++;
                    if (completed === items.length) {
                        res.json({ success: true, orderId, orderNo });
                    }
                });
            });
        });
    });
});

// ─── API: Stores (Multi-Store) ────────────────────────────────────────────
app.get('/api/stores', authenticateToken, (req, res) => {
    db.all('SELECT * FROM stores WHERE is_active = 1 ORDER BY name', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch stores' });
        }
        res.json(rows || []);
    });
});

app.post('/api/stores', authenticateToken, (req, res) => {
    const { name, location, phone, email, address } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Store name required' });
    }

    db.run(`
        INSERT INTO stores (name, location, phone, email, address)
        VALUES (?, ?, ?, ?, ?)
    `, [name, location || '', phone || '', email || '', address || ''], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to create store' });
        }
        res.json({ success: true, message: 'Store created' });
    });
});

// ─── API: Dashboard Stats ──────────────────────────────────────────────────
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
    const storeId = req.user.storeId || 1;

    Promise.all([
        new Promise((resolve) => {
            db.get('SELECT SUM(total) as total_sales FROM orders WHERE store_id = ?', [storeId], (err, row) => {
                resolve(row?.total_sales || 0);
            });
        }),
        new Promise((resolve) => {
            db.get('SELECT COUNT(*) as count FROM orders WHERE store_id = ?', [storeId], (err, row) => {
                resolve(row?.count || 0);
            });
        }),
        new Promise((resolve) => {
            db.get('SELECT SUM(stock) as total_stock FROM products WHERE store_id = ?', [storeId], (err, row) => {
                resolve(row?.total_stock || 0);
            });
        })
    ]).then(([totalSales, orderCount, totalStock]) => {
        res.json({ totalSales, orderCount, totalStock });
    });
});

// ─── Static Files ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ─── Start Server ──────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`🚀 Biznex2 Server running on http://localhost:${PORT}`);
    logger.info(`Server started on port ${PORT}`);
});

module.exports = server;
