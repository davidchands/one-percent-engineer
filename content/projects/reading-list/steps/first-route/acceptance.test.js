import { test } from "node:test";
import assert from "node:assert/strict";

const base = process.env.BASE_URL;

async function getJson(path) {
  const res = await fetch(base + path);
  const type = res.headers.get("content-type") ?? "(none)";
  const text = await res.text();
  return { res, type, text };
}

test("GET /api/health answers with status 200", async () => {
  const { res } = await getJson("/api/health");
  assert.equal(res.status, 200, `got status ${res.status}`);
});

test("GET /api/health says it's JSON in its Content-Type", async () => {
  const { type } = await getJson("/api/health");
  assert.match(type, /^application\/json/, `Content-Type was ${type}`);
});

test('GET /api/health answers {"ok":true}', async () => {
  const { text } = await getJson("/api/health");
  assert.deepEqual(JSON.parse(text), { ok: true }, `body was ${text}`);
});

test("GET /api/books answers with status 200", async () => {
  const { res } = await getJson("/api/books");
  assert.equal(res.status, 200, `got status ${res.status}`);
});

test("GET /api/books says it's JSON in its Content-Type", async () => {
  const { type } = await getJson("/api/books");
  assert.match(type, /^application\/json/, `Content-Type was ${type}`);
});

test("GET /api/books answers with an empty JSON array", async () => {
  const { text } = await getJson("/api/books");
  let body;
  assert.doesNotThrow(() => (body = JSON.parse(text)), `body isn't JSON: ${text.slice(0, 80)}`);
  assert.ok(Array.isArray(body), `expected an array, got ${text.slice(0, 80)}`);
  assert.equal(body.length, 0, "there are no books yet, so the list should be empty");
});

test("an unknown path answers with status 404", async () => {
  const { res } = await getJson("/api/this-does-not-exist");
  assert.equal(res.status, 404, `got status ${res.status}`);
});
