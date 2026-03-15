require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function migrate() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
    const client = await pool.connect();
    try {
        // Create a schema_migrations tracking table (idempotent)
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // Run all *.sql files in migrations/ in alphabetical order, skipping already-applied ones
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const applied = await client.query(
                'SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
            if (applied.rows.length > 0) {
                console.log(`  ⏭  ${file} (already applied)`);
                continue;
            }
            console.log(`  ▶  Running ${file}…`);
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
            console.log(`  ✅ ${file} applied`);
        }

        console.log('\n✅ All migrations complete');

        // Seed admin account if not exists
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@biznex.local';
        const adminPass  = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
        const exists = await client.query('SELECT id FROM accounts WHERE email=$1', [adminEmail]);
        if (exists.rows.length === 0) {
            const hash = await bcrypt.hash(adminPass, 12);
            await client.query(
                `INSERT INTO accounts (email, password, name, role) VALUES ($1,$2,$3,'admin')`,
                [adminEmail, hash, 'Admin']
            );
            console.log(`✅ Admin account created: ${adminEmail}`);
        } else {
            console.log(`ℹ️  Admin account already exists: ${adminEmail}`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch((err) => { console.error('Migration failed:', err); process.exit(1); });
