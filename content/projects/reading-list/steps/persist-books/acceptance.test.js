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

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectDir = process.env.PROJECT_DIR;

async function freePort() {
  return new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** Starts a second copy of the app from your project folder, like a restart, and runs fn against it. */
async function withSecondInstance(fn) {
  const script = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8")).scripts?.start;
  const port = await freePort();
  const child = spawn("/bin/sh", ["-c", script], { cwd: projectDir, env: { ...process.env, PORT: String(port) }, detached: true, stdio: "ignore" });
  const url = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 6000;
    for (;;) {
      try {
        await fetch(url + "/api/health");
        break;
      } catch {
        if (Date.now() > deadline) assert.fail("the restarted copy of your app never answered");
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return await fn(url);
  } finally {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }
}

test("a book you add is still there after the app restarts", async () => {
  const title = unique("Persistence");
  const added = await request("POST", "/api/books", { title, author: "Ada Lovelace" });
  assert.equal(added.status, 201, `adding a book answered ${added.status}`);
  await withSecondInstance(async (url) => {
    const list = await (await fetch(url + "/api/books")).json();
    const found = list.find((b) => b.id === added.json.id);
    assert.ok(found, "after a restart your book is gone: it was only kept in memory, or not saved yet");
    assert.equal(found.title, title);
    assert.equal(found.author, "Ada Lovelace", "the author wasn't kept");
  });
});

test("books added after a restart get new ids, not ones already used", async () => {
  const first = await request("POST", "/api/books", { title: unique("Before restart"), author: "x" });
  await withSecondInstance(async (url) => {
    const res = await fetch(url + "/api/books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: unique("After restart"), author: "y" }),
    });
    const second = await res.json();
    assert.notEqual(second.id, first.json.id, "the restarted app reused an id that already belongs to a book");
    const list = await (await fetch(url + "/api/books")).json();
    const ids = list.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length, "two books share an id");
  });
});

test("the live app still lists the books it just stored", async () => {
  const title = unique("Still listed");
  const added = await request("POST", "/api/books", { title, author: "z" });
  const list = await request("GET", "/api/books");
  assert.ok(list.json?.some((b) => b.id === added.json?.id), "the book you just added isn't in the list");
});
