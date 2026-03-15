const express = require("express");
const router = express.Router();
const db = require("../db/db");
const auth = require("../middleware/auth");

// Get all products
router.get("/", auth, (req, res) => {
  db.all("SELECT * FROM products ORDER BY name", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch products" });
    }
    res.json(rows);
  });
});

// Create product
router.post("/", auth, (req, res) => {
  const {
    name,
    sku,
    category,
    price,
    cost,
    quantity,
    reorder_point,
    supplier,
    description
  } = req.body;

  if (!name || price == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    INSERT INTO products
    (name, sku, category, price, cost, quantity, reorder_point, supplier, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [name, sku, category, price, cost, quantity, reorder_point, supplier, description],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Failed to create product" });
      }
      res.json({ id: this.lastID });
    }
  );
});

// Update product
router.put("/:id", auth, (req, res) => {
  const id = req.params.id;
  const {
    name,
    sku,
    category,
    price,
    cost,
    quantity,
    reorder_point,
    supplier,
    description
  } = req.body;

  const sql = `
    UPDATE products SET
      name = ?, sku = ?, category = ?, price = ?, cost = ?,
      quantity = ?, reorder_point = ?, supplier = ?, description = ?
    WHERE id = ?
  `;

  db.run(
    sql,
    [name, sku, category, price, cost, quantity, reorder_point, supplier, description, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Failed to update product" });
      }
      res.json({ success: true });
    }
  );
});

module.exports = router;
