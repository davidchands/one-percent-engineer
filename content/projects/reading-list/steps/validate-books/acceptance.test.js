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

const good = () => ({ title: unique("Valid"), author: "Some Author" });

async function countBooks() {
  const r = await request("GET", "/api/books");
  return r.json.length;
}

function assertRefused(r, why) {
  assert.equal(r.status, 400, `${why}: expected 400, got ${r.status} ${r.text.slice(0, 60)}`);
  assert.match(r.type, /^application\/json/, `${why}: the error should be JSON, Content-Type was ${r.type}`);
  assert.equal(typeof r.json?.error, "string", `${why}: the body should have an "error" sentence, got ${r.text.slice(0, 60)}`);
}

test("a valid book is still created (201)", async () => {
  const r = await request("POST", "/api/books", good());
  assert.equal(r.status, 201);
});

test("a book without a title is refused with 400 and a reason", async () => {
  assertRefused(await request("POST", "/api/books", { author: "x" }), "no title");
});

test("a title that is empty or only spaces is refused", async () => {
  assertRefused(await request("POST", "/api/books", { title: "", author: "x" }), "empty title");
  assertRefused(await request("POST", "/api/books", { title: "   ", author: "x" }), "blank title");
});

test("a title that isn't text is refused", async () => {
  assertRefused(await request("POST", "/api/books", { title: 42, author: "x" }), "number title");
});

test("a book without an author is refused", async () => {
  assertRefused(await request("POST", "/api/books", { title: unique("No author") }), "no author");
});

test("a status that isn't want, reading or read is refused", async () => {
  assertRefused(await request("POST", "/api/books", { ...good(), status: "abandoned" }), "bad status");
});

test("a body that isn't JSON is refused with 400, and the server keeps running", async () => {
  assertRefused(await request("POST", "/api/books", undefined, "{this is not json"), "broken JSON");
  const health = await request("GET", "/api/health");
  assert.equal(health.status, 200, "the server stopped answering after a bad request");
});

test("a JSON body that isn't an object is refused", async () => {
  assertRefused(await request("POST", "/api/books", ["a", "b"]), "array body");
});

test("refused books are not stored", async () => {
  const before = await countBooks();
  await request("POST", "/api/books", { title: "", author: "x" });
  await request("POST", "/api/books", { title: unique("Bad status"), author: "x", status: "nope" });
  assert.equal(await countBooks(), before, "a refused book was saved anyway");
});

test("spaces around a title are trimmed", async () => {
  const word = unique("Trim");
  const r = await request("POST", "/api/books", { title: `  ${word}  `, author: "  Someone  " });
  assert.equal(r.json?.title, word);
  assert.equal(r.json?.author, "Someone");
});

test("GET /api/books/:id answers one book", async () => {
  const added = await request("POST", "/api/books", good());
  const r = await request("GET", `/api/books/${added.json.id}`);
  assert.equal(r.status, 200);
  assert.equal(r.json?.title, added.json.title);
});

test("GET /api/books/:id for a book that doesn't exist answers 404", async () => {
  const r = await request("GET", "/api/books/987654321");
  assert.equal(r.status, 404, `got ${r.status}`);
  assert.equal(typeof r.json?.error, "string", "the 404 body should have an \"error\" sentence");
});
