const express = require("express");
const router = express.Router();
const db = require("../db/db");
const auth = require("../middleware/auth");

/**
 * SALES REPORT
 */
router.get("/sales", auth, (req, res) => {
  const sql = `
    SELECT
      COUNT(*) as transactions,
      SUM(total) as total_sales,
      AVG(total) as avg_sale
    FROM orders
  `;

  db.get(sql, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Failed to load sales report" });
    }
    res.json(row);
  });
});

/**
 * TOP EMPLOYEES
 */
router.get("/employees", auth, (req, res) => {
  const sql = `
    SELECT
      employee,
      COUNT(*) as transactions,
      SUM(total) as sales
    FROM orders
    GROUP BY employee
    ORDER BY sales DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Failed to load employee report" });
    }
    res.json(rows);
  });
});

/**
 * INVENTORY REPORT
 */
router.get("/inventory", auth, (req, res) => {
  const sql = `
    SELECT
      COUNT(*) as total_products,
      SUM(quantity) as total_units,
      SUM(quantity * price) as stock_value,
      SUM(CASE WHEN quantity <= reorder_point THEN 1 ELSE 0 END) as low_stock
    FROM products
  `;

  db.get(sql, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Failed to load inventory report" });
    }
    res.json(row);
  });
});

module.exports = router;
