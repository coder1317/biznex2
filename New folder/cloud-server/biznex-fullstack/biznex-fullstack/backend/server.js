const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const db = require("./db/db");
const jwt = require("jsonwebtoken");
const { secret, expiresIn } = require("./config/jwt");
const auth = require("./middleware/auth");

const ordersRoutes = require("./routes/orders");
const productsRoutes = require("./routes/products");

const app = express();
app.use(cors());
app.use(express.json());

// Run schema once and seed demo data if needed
const schema = fs.readFileSync(path.join(__dirname, "db", "schema.sql"), "utf8");
db.exec(schema, (err) => {
  if (err) {
    console.error("Failed to initialize DB schema:", err.message);
  } else {
    console.log("DB schema ensured");
    try {
      require("./db/seed");
    } catch (e) {
      console.warn("Seed failed to run:", e && e.message ? e.message : e);
    }
  }
});

// Demo-friendly login: accept username and issue JWT
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Missing username" });

  const user = { id: 1, username };
  const token = jwt.sign({ sub: user.id, username: user.username, role: "Admin" }, secret, {
    expiresIn,
  });
  res.json({ token });
});

app.use("/orders", auth, ordersRoutes);
app.use("/products", productsRoutes);
app.use("/reports", require("./routes/reports"));
app.use("/complaints", require("./routes/complaints"));

app.listen(3000, () => {
  console.log("Backend running at http://localhost:3000");
});
