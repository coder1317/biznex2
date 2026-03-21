const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'portal.db');
console.log('🗑️ Clearing account data from portal database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ DB connection error:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to portal database');
});

db.serialize(() => {
    // Clear all account-related data
    const tables = ['stores', 'license_keys', 'accounts'];

    tables.forEach(table => {
        db.run(`DELETE FROM ${table}`, [], (err) => {
            if (err) {
                console.error(`❌ Error clearing ${table}:`, err.message);
            } else {
                console.log(`✅ Cleared ${table} table`);
            }
        });
    });

    // Reset auto-increment counters
    db.run(`DELETE FROM sqlite_sequence WHERE name IN ('accounts', 'license_keys', 'stores')`, [], (err) => {
        if (err) {
            console.error('❌ Error resetting sequences:', err.message);
        } else {
            console.log('✅ Reset auto-increment counters');
        }
    });

    // Close database after operations complete
    setTimeout(() => {
        db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err.message);
                process.exit(1);
            } else {
                console.log('🎉 Portal account data cleared successfully! Ready for fresh start.');
            }
        });
    }, 1000);
});
