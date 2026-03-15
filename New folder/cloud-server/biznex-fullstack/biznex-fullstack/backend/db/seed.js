const db = require("./db");

const products = [
  ["Laptop", "LAP-001", "Electronics", 82999, 58000, 10, 3, "TechVendor", "Demo laptop"],
  ["Mouse", "MOU-001", "Electronics", 2499, 1200, 50, 10, "TechVendor", "Wireless mouse"],
  ["Keyboard", "KEY-001", "Electronics", 5999, 3000, 25, 5, "TechVendor", "Mechanical keyboard"],
  ["T-Shirt", "TSH-001", "Clothing", 1499, 600, 40, 10, "FashionCo", "Cotton tee"],
  ["Jeans", "JEA-001", "Clothing", 3999, 1800, 20, 5, "FashionCo", "Blue denim"],
  ["Coffee", "COF-001", "Food", 499, 200, 100, 20, "CafeSuppliers", "Ground coffee"],
];

db.serialize(() => {
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (err) return console.error("Seed check failed:", err.message);
    if (row && row.count === 0) {
      const stmt = db.prepare(`
        INSERT INTO products 
        (name, sku, category, price, cost, quantity, reorder_point, supplier, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      products.forEach(p => stmt.run(p));
      stmt.finalize();
      console.log("✅ Demo products seeded");
    } else {
      console.log("ℹ️ Products already exist, skipping seed");
    }
  });
});
