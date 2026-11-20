import express from "express";

const app = express();

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/books", (req, res) => {
  res.send("[]");
});

app.listen(process.env.PORT, () => {
  console.log(`Reading list server on port ${process.env.PORT}`);
});
