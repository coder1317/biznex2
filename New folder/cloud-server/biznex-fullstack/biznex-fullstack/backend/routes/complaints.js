const express = require("express");
const router = express.Router();
const db = require("../db/db");
const auth = require("../middleware/auth");

// Submit complaint (ANY logged-in user)
router.post("/", auth, (req, res) => {
  const { employee, details } = req.body;

  if (!employee || !details) {
    return res.status(400).json({ error: "Missing complaint data" });
  }

  const sql = `
    INSERT INTO complaints (employee, details)
    VALUES (?, ?)
  `;

  db.run(sql, [employee, details], function (err) {
    if (err) {
      return res.status(500).json({ error: "Failed to submit complaint" });
    }
    res.json({ id: this.lastID });
  });
});

// Get all complaints (Admin / Incharge)
router.get("/", auth, (req, res) => {
  db.all(
    "SELECT * FROM complaints ORDER BY created_at DESC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Failed to fetch complaints" });
      }
      res.json(rows);
    }
  );
});

// Mark complaint as resolved
router.put("/:id/resolve", auth, (req, res) => {
  const id = req.params.id;

  db.run(
    "UPDATE complaints SET status='Resolved' WHERE id=?",
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Failed to resolve complaint" });
      }
      res.json({ success: true });
    }
  );
});

module.exports = router;
