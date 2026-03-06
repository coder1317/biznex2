
const express = require("express");
const db = require("../db/db");
const applyOp = require("../services/applyOperation");
const router = express.Router();

router.post("/", async (req, res) => {
  const { deviceId, operations } = req.body;
  const ack=[], rej=[];

  for (const op of operations) {
    const seen = await new Promise(r=>db.get("SELECT id FROM events WHERE id=?", [op.opId],(_,row)=>r(row)));
    if (seen) { ack.push(op.opId); continue; }
    try {
      await applyOp(op, db);
      db.run("INSERT INTO events VALUES (?,?,?,?,?,?)",[op.opId,deviceId,op.type,op.entityId,JSON.stringify(op.payload),op.createdAt]);
      ack.push(op.opId);
    } catch(e) {
      rej.push({ opId: op.opId, reason: e.message });
    }
  }
  res.json({ acknowledgedOps: ack, rejectedOps: rej });
});

module.exports = router;
