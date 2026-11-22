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

async function page() {
  return request("GET", "/");
}

test("GET / answers with a web page", async () => {
  const r = await page();
  assert.equal(r.status, 200, `got ${r.status}`);
  assert.match(r.type, /^text\/html/, `Content-Type was ${r.type}: the browser needs text/html to show a page`);
});

test("the page has a form with a title and an author field", async () => {
  const { text } = await page();
  assert.match(text, /<form/i, "no <form> in the page");
  assert.match(text, /name=["']title["']/i, 'no input with name="title"');
  assert.match(text, /name=["']author["']/i, 'no input with name="author"');
});

test('the page has a list element with id="book-list" and a script', async () => {
  const { text } = await page();
  assert.match(text, /id=["']book-list["']/i, 'no element with id="book-list" to fill with books');
  assert.match(text, /<script/i, "no <script>: something has to fetch the books and show them");
});

test("the page has a title for the browser tab", async () => {
  const { text } = await page();
  assert.match(text, /<title>[^<]+<\/title>/i, "the page has no <title>");
});

test("the API still works next to the page", async () => {
  assert.equal((await request("GET", "/api/health")).status, 200);
  const added = await request("POST", "/api/books", { title: unique("With page"), author: "x" });
  assert.equal(added.status, 201);
});

test("unknown paths are still 404", async () => {
  assert.equal((await request("GET", "/nothing-here")).status, 404);
});
