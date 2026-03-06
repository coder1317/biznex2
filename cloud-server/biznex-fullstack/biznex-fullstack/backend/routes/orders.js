const express = require("express");
const router = express.Router();
const db = require("../db/db");
const auth = require("../middleware/auth");

// Get all orders
router.get("/", auth, (req, res) => {
  db.all("SELECT * FROM orders ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch orders" });
    }
    res.json(rows);
  });
});

// Create order
router.post("/", auth, (req, res) => {
  const { store_id, employee, customer, total, items } = req.body;

  if (!store_id || !employee || !total || !Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid order payload" });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const orderSql = `
      INSERT INTO orders (store_id, employee, customer, total)
      VALUES (?, ?, ?, ?)
    `;

    db.run(orderSql, [store_id, employee, customer, total], function (err) {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: "Order creation failed" });
      }

      const orderId = this.lastID;

      const itemSql = `
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `;

      const stockSql = `
        UPDATE products
        SET quantity = quantity - ?
        WHERE id = ? AND quantity >= ?
      `;

      for (const item of items) {
        db.run(itemSql, [orderId, item.id, item.qty, item.price]);
        db.run(stockSql, [item.qty, item.id, item.qty], function (err) {
          if (err || this.changes === 0) {
            db.run("ROLLBACK");
            return res.status(400).json({
              error: "Insufficient stock for product ID " + item.id
            });
          }
        });
      }

      db.run("COMMIT");
      res.json({ success: true, order_id: orderId });
    });
  });
});

module.exports = router;
