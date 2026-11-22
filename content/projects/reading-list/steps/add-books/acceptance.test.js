import { test } from "node:test";
import assert from "node:assert/strict";

const base = process.env.BASE_URL;

async function request(method, path, body, rawBody) {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined || rawBody !== undefined ? { "content-type": "application/json" } : {},
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { res, status: res.status, type: res.headers.get("content-type") ?? "(none)", text, json };
}

let counter = 0;
const unique = (word) => `${word} ${Date.now()}-${++counter}`;

test("POST /api/books answers 201 (created)", async () => {
  const r = await request("POST", "/api/books", { title: unique("Dune"), author: "Frank Herbert" });
  assert.equal(r.status, 201, `got status ${r.status}: ${r.text.slice(0, 80)}`);
});

test("POST /api/books answers with the new book as JSON", async () => {
  const title = unique("Emma");
  const r = await request("POST", "/api/books", { title, author: "Jane Austen" });
  assert.match(r.type, /^application\/json/, `Content-Type was ${r.type}`);
  assert.ok(r.json, `body isn't JSON: ${r.text.slice(0, 80)}`);
  assert.equal(r.json.title, title);
  assert.equal(r.json.author, "Jane Austen");
});

test("a new book gets a number id and starts with status \"want\"", async () => {
  const r = await request("POST", "/api/books", { title: unique("Ulysses"), author: "James Joyce" });
  assert.equal(typeof r.json?.id, "number", `id should be a number, body was ${r.text.slice(0, 80)}`);
  assert.equal(r.json.status, "want");
});

test("GET /api/books lists a book you added", async () => {
  const title = unique("Beloved");
  const added = await request("POST", "/api/books", { title, author: "Toni Morrison" });
  const list = await request("GET", "/api/books");
  assert.ok(Array.isArray(list.json), "GET /api/books should answer a JSON array");
  const found = list.json.find((b) => b.id === added.json?.id);
  assert.ok(found, "the book you added isn't in the list");
  assert.equal(found.title, title);
});

test("every book gets its own id", async () => {
  const a = await request("POST", "/api/books", { title: unique("A"), author: "x" });
  const b = await request("POST", "/api/books", { title: unique("B"), author: "y" });
  assert.notEqual(a.json?.id, b.json?.id, "two books got the same id");
});
