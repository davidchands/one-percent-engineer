import express from "express";
import * as books from "./books.js";
import { checkNewBook } from "./validate.js";

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/books", (req, res) => {
  res.json(books.list());
});

app.post("/api/books", (req, res) => {
  const problem = checkNewBook(req.body);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  res.status(201).json(books.add(req.body));
});

app.get("/api/books/:id", (req, res) => {
  const book = books.get(Number(req.params.id));
  if (book) res.json(book);
  else res.status(404).json({ error: "No book with that id" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Express passes errors (like a body that isn't valid JSON) here.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: "The request body isn't valid JSON" });
  } else {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Reading list server on port ${process.env.PORT}`);
});
