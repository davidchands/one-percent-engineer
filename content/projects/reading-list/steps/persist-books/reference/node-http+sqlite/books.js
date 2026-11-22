import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const db = new DatabaseSync(fileURLToPath(new URL("./books.db", import.meta.url)));
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'want'
  )
`);

export function list() {
  return db.prepare("SELECT id, title, author, status FROM books ORDER BY id").all();
}

export function get(id) {
  return db.prepare("SELECT id, title, author, status FROM books WHERE id = ?").get(id) ?? null;
}

export function add({ title, author, status = "want" }) {
  const result = db.prepare("INSERT INTO books (title, author, status) VALUES (?, ?, ?)").run(title.trim(), author.trim(), status);
  return get(Number(result.lastInsertRowid));
}
