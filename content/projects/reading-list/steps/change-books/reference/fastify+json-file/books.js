import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = new URL("./books.json", import.meta.url);

function load() {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
}

function save(books) {
  writeFileSync(file, JSON.stringify(books, null, 2));
}

export function list() {
  return load();
}

export function get(id) {
  return load().find((b) => b.id === id) ?? null;
}

export function add({ title, author, status = "want" }) {
  const books = load();
  const id = books.reduce((max, b) => Math.max(max, b.id), 0) + 1;
  const book = { id, title: title.trim(), author: author.trim(), status };
  books.push(book);
  save(books);
  return book;
}

export function update(id, patch) {
  const books = load();
  const book = books.find((b) => b.id === id);
  if (!book) return null;
  Object.assign(book, patch);
  save(books);
  return book;
}

export function remove(id) {
  const books = load();
  const rest = books.filter((b) => b.id !== id);
  if (rest.length === books.length) return false;
  save(rest);
  return true;
}
