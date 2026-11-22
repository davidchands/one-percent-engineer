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

async function add() {
  const r = await request("POST", "/api/books", { title: unique("Change me"), author: "Some Author" });
  assert.equal(r.status, 201, "this check needs adding a book to work first");
  return r.json;
}

test("PATCH changes a book's status and answers the updated book", async () => {
  const book = await add();
  const r = await request("PATCH", `/api/books/${book.id}`, { status: "reading" });
  assert.equal(r.status, 200, `got ${r.status}: ${r.text.slice(0, 80)}`);
  assert.equal(r.json?.status, "reading");
  assert.equal(r.json?.title, book.title, "the title was lost in the update");
  assert.equal(r.json?.author, book.author, "the author was lost in the update");
});

test("the change is really stored", async () => {
  const book = await add();
  await request("PATCH", `/api/books/${book.id}`, { status: "read" });
  const again = await request("GET", `/api/books/${book.id}`);
  assert.equal(again.json?.status, "read");
  assert.equal(again.json?.title, book.title, "the title was lost");
});

test("PATCH with a status that doesn't exist is refused and changes nothing", async () => {
  const book = await add();
  const r = await request("PATCH", `/api/books/${book.id}`, { status: "abandoned" });
  assert.equal(r.status, 400, `got ${r.status}`);
  const again = await request("GET", `/api/books/${book.id}`);
  assert.equal(again.json?.status, "want");
});

test("PATCH for a book that doesn't exist answers 404", async () => {
  const r = await request("PATCH", "/api/books/987654321", { status: "read" });
  assert.equal(r.status, 404, `got ${r.status}`);
});

test("DELETE removes a book and answers 204", async () => {
  const book = await add();
  const r = await request("DELETE", `/api/books/${book.id}`);
  assert.equal(r.status, 204, `got ${r.status}`);
  assert.equal(r.text, "", "a 204 answer has no body");
});

test("a deleted book is gone from the list and from its own URL", async () => {
  const book = await add();
  await request("DELETE", `/api/books/${book.id}`);
  const list = await request("GET", "/api/books");
  assert.ok(!list.json.some((b) => b.id === book.id), "the book is still in the list");
  assert.equal((await request("GET", `/api/books/${book.id}`)).status, 404);
});

test("deleting one book keeps the others", async () => {
  const keep = await add();
  const drop = await add();
  await request("DELETE", `/api/books/${drop.id}`);
  const list = await request("GET", "/api/books");
  assert.ok(list.json.some((b) => b.id === keep.id), "the other book disappeared too");
});

test("DELETE for a book that doesn't exist answers 404", async () => {
  const r = await request("DELETE", "/api/books/987654321");
  assert.equal(r.status, 404, `got ${r.status}`);
});
