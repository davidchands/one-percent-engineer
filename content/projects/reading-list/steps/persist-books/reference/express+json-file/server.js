import express from "express";
import * as books from "./books.js";

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/books", (req, res) => {
  res.json(books.list());
});

app.post("/api/books", (req, res) => {
  res.status(201).json(books.add(req.body));
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(process.env.PORT, () => {
  console.log(`Reading list server on port ${process.env.PORT}`);
});
