
module.exports = function(op, db) {
  return new Promise((res, rej) => {
    if (op.type === "ORDER_CREATE") {
      db.run(
        "INSERT INTO orders VALUES (?,?,?,?,?)",
        [op.entityId, op.payload.storeId, "QUEUED", op.payload.customer, 0, op.createdAt],
        e => e ? rej(e) : res()
      );
    } else if (op.type === "ORDER_MARK_PAID") {
      db.run("UPDATE orders SET status='PAID' WHERE id=?", [op.entityId], e => e ? rej(e) : res());
    } else {
      rej(new Error("UNKNOWN_OP"));
    }
  });
};
