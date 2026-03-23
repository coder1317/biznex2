const fs = require("fs");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "biznex2.json");
console.log("📊 DB PATH:", dbPath);

// Simple file-based database for demo
class SimpleDB {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = this.loadData();
        this.initializeTables();
        console.log("✅ DB connected");
    }

    loadData() {
        if (fs.existsSync(this.filePath)) {
            try {
                return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
            } catch (err) {
                console.error("❌ Error loading DB:", err.message);
            }
        }
        return this.getDefaultSchema();
    }

    getDefaultSchema() {
        return {
            system_settings: [],
            stores: [],
            products: [],
            orders: [],
            order_items: [],
            users: [],
            stock_movements: [],
            categories: []
        };
    }

    saveData() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }

    initializeTables() {
        console.log("✅ system_settings table ready");
        console.log("✅ stores table ready");
        console.log("✅ products table ready");
        console.log("✅ orders table ready");
        console.log("✅ order_items table ready");
        console.log("✅ users table ready");
        console.log("✅ stock_movements table ready");
        console.log("✅ categories table ready");

        // Create default store if needed
        if (this.data.stores.length === 0) {
            this.data.stores.push({
                id: 1,
                name: "Main Store",
                location: "Headquarters",
                phone: "",
                email: "",
                address: "",
                is_active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            this.saveData();
            console.log("✅ Default store created");
        }
    }

    serialize(callback) {
        callback();
    }

    run(sql, params = [], callback) {
        try {
            // Parse simple SQL for INSERT/UPDATE/DELETE
            if (sql.includes("INSERT INTO")) {
                const tableMatch = sql.match(/INSERT INTO (\w+)/i);
                if (tableMatch) {
                    const table = tableMatch[1].toLowerCase();
                    const id = (this.data[table]?.length || 0) + 1;
                    const row = { id, ...this.extractInsertData(sql, params) };
                    if (!this.data[table]) this.data[table] = [];
                    this.data[table].push(row);
                    this.saveData();
                    return callback?.(null);
                }
            } else if (sql.includes("UPDATE")) {
                const tableMatch = sql.match(/UPDATE (\w+)/i);
                if (tableMatch) {
                    const table = tableMatch[1].toLowerCase();
                    const whereMatch = sql.match(/WHERE id\s*=\s*\?/i);
                    if (whereMatch && this.data[table]) {
                        const id = params[params.length - 1];
                        const idx = this.data[table].findIndex(r => r.id == id);
                        if (idx !== -1) {
                            const updates = this.extractUpdateData(sql, params);
                            this.data[table][idx] = { ...this.data[table][idx], ...updates };
                            this.saveData();
                        }
                    }
                    return callback?.(null);
                }
            } else if (sql.includes("DELETE FROM")) {
                const tableMatch = sql.match(/DELETE FROM (\w+)/i);
                if (tableMatch) {
                    const table = tableMatch[1].toLowerCase();
                    const whereMatch = sql.match(/WHERE id\s*=\s*\?/i);
                    if (whereMatch && this.data[table]) {
                        const id = params[0];
                        this.data[table] = this.data[table].filter(r => r.id != id);
                        this.saveData();
                    }
                    return callback?.(null);
                }
            } else if (sql.includes("CREATE TABLE")) {
                return callback?.(null);
            }
            callback?.(null);
        } catch (err) {
            callback?.(err);
        }
    }

    get(sql, params = [], callback) {
        try {
            if (sql.includes("SELECT COUNT(*) as count FROM")) {
                const tableMatch = sql.match(/FROM (\w+)/i);
                if (tableMatch) {
                    const table = tableMatch[1].toLowerCase();
                    const row = { count: this.data[table]?.length || 0 };
                    return callback?.(null, row);
                }
            } else if (sql.includes("SELECT * FROM")) {
                const tableMatch = sql.match(/FROM (\w+)/i);
                if (tableMatch) {
                    const table = tableMatch[1].toLowerCase();
                    const whereMatch = sql.match(/WHERE (\w+)\s*=\s*\?/i);
                    if (whereMatch) {
                        const col = whereMatch[1];
                        const val = params[0];
                        const row = (this.data[table] || []).find(r => r[col] == val);
                        return callback?.(null, row);
                    }
                }
            }
            callback?.(null, null);
        } catch (err) {
            callback?.(err);
        }
    }

    all(sql, params = [], callback) {
        try {
            if (sql.includes("SELECT")) {
                const tableMatch = sql.match(/FROM (\w+)/i);
                if (tableMatch) {
                    const table = tableMatch[1].toLowerCase();
                    let rows = this.data[table] || [];

                    // Handle WHERE clauses
                    const whereMatch = sql.match(/WHERE (.+?)(ORDER BY|LIMIT|$)/i);
                    if (whereMatch) {
                        const whereClause = whereMatch[1];
                        if (whereClause.includes("store_id") && params.length > 0) {
                            rows = rows.filter(r => r.store_id == params[0]);
                        }
                    }

                    // Handle ORDER BY
                    const orderMatch = sql.match(/ORDER BY (\w+) (DESC|ASC)?/i);
                    if (orderMatch) {
                        const col = orderMatch[1];
                        const dir = (orderMatch[2] || "ASC").toUpperCase();
                        rows.sort((a, b) => {
                            const aVal = a[col];
                            const bVal = b[col];
                            if (aVal < bVal) return dir === "DESC" ? 1 : -1;
                            if (aVal > bVal) return dir === "DESC" ? -1 : 1;
                            return 0;
                        });
                    }

                    // Handle LIMIT
                    const limitMatch = sql.match(/LIMIT (\d+)/i);
                    if (limitMatch) {
                        rows = rows.slice(0, parseInt(limitMatch[1]));
                    }

                    return callback?.(null, rows);
                }
            }
            callback?.(null, []);
        } catch (err) {
            callback?.(err, []);
        }
    }

    extractInsertData(sql, params) {
        const columnsMatch = sql.match(/\((.*?)\)\s*VALUES/i);
        const columns = columnsMatch ? columnsMatch[1].split(",").map(c => c.trim().toLowerCase()) : [];
        const data = {};
        columns.forEach((col, i) => {
            data[col] = params[i];
        });
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();
        return data;
    }

    extractUpdateData(sql, params) {
        const setsMatch = sql.match(/SET (.*?) WHERE/i);
        const sets = setsMatch ? setsMatch[1].split(",").map(s => s.trim().split("=")[0].trim().toLowerCase()) : [];
        const data = {};
        sets.forEach((col, i) => {
            if (i < params.length - 1) {
                data[col] = params[i];
            }
        });
        data.updated_at = new Date().toISOString();
        return data;
    }

    ready(callback) {
        callback?.();
    }
}

const db = new SimpleDB(dbPath);

module.exports = db;
