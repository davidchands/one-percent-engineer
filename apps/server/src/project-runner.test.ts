import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProjectChecks } from "./project-runner.ts";

/** Makes a throwaway project folder from a map of file names to contents. */
function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "1pe-project-test-"));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

const pkg = (start?: string) => JSON.stringify({ type: "module", scripts: start ? { start } : {} });

const helloServer = `
import { createServer } from "node:http";
createServer((req, res) => {
  res.writeHead(req.url === "/hello" ? 200 : 404, { "content-type": "text/plain" });
  res.end(req.url === "/hello" ? "hi" : "not found");
}).listen(process.env.PORT);
`;

const helloChecks = `
import { test } from "node:test";
import assert from "node:assert/strict";
test("GET /hello says hi", async () => {
  const res = await fetch(process.env.BASE_URL + "/hello");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "hi");
});
test("an unknown path is a 404", async () => {
  const res = await fetch(process.env.BASE_URL + "/nope");
  assert.equal(res.status, 404);
});
`;

test("starts the app on the given port, runs the checks, and reports each one", async () => {
  const dir = project({ "package.json": pkg("node server.js"), "server.js": helloServer });
  try {
    const r = await runProjectChecks(dir, { acceptanceTests: helloChecks, startsApp: true });
    assert.equal(r.startup, "ok");
    assert.equal(r.passed, 2);
    assert.equal(r.failed, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failing check names the behaviour and carries the assertion message", async () => {
  const dir = project({ "package.json": pkg("node server.js"), "server.js": helloServer.replace('"hi"', '"hello"') });
  try {
    const r = await runProjectChecks(dir, { acceptanceTests: helloChecks, startsApp: true });
    const failed = r.cases.find((c) => !c.passed);
    assert.equal(failed?.name, "GET /hello says hi");
    assert.match(failed?.message ?? "", /hello/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a project with no start script is told how to add one", async () => {
  const dir = project({ "package.json": pkg() });
  try {
    const r = await runProjectChecks(dir, { acceptanceTests: helloChecks, startsApp: true });
    assert.equal(r.startup, "no_start_script");
    assert.match(r.cases[0]!.message!, /"start"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an app that crashes on start reports its own error output", async () => {
  const dir = project({ "package.json": pkg("node server.js"), "server.js": 'throw new Error("boom at startup");' });
  try {
    const r = await runProjectChecks(dir, { acceptanceTests: helloChecks, startsApp: true });
    assert.equal(r.startup, "exited");
    assert.match(r.appOutput, /boom at startup/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an app that ignores PORT times out with a hint about process.env.PORT", { timeout: 20_000 }, async () => {
  const dir = project({ "package.json": pkg("node server.js"), "server.js": "setInterval(() => {}, 1000);" });
  try {
    const r = await runProjectChecks(dir, { acceptanceTests: helloChecks, startsApp: true });
    assert.equal(r.startup, "timeout");
    assert.match(r.cases[0]!.message!, /process\.env\.PORT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the app is stopped after the checks, so its port is free again", async () => {
  const dir = project({ "package.json": pkg("node server.js"), "server.js": helloServer });
  const portChecks = `
import { test } from "node:test";
import { writeFileSync } from "node:fs";
test("record the port", () => writeFileSync(process.env.PROJECT_DIR + "/port.txt", new URL(process.env.BASE_URL).port));
`;
  try {
    await runProjectChecks(dir, { acceptanceTests: portChecks, startsApp: true });
    const { readFileSync } = await import("node:fs");
    const port = readFileSync(join(dir, "port.txt"), "utf8");
    await assert.rejects(fetch(`http://127.0.0.1:${port}/hello`, { signal: AbortSignal.timeout(1000) }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("steps that only check files don't need a start script", async () => {
  const dir = project({ "index.html": "<h1>Reading list</h1>" });
  const fileChecks = `
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("index.html has a heading", () => assert.match(readFileSync(process.env.PROJECT_DIR + "/index.html", "utf8"), /<h1>/));
`;
  try {
    const r = await runProjectChecks(dir, { acceptanceTests: fileChecks, startsApp: false });
    assert.equal(r.startup, "not_needed");
    assert.equal(r.passed, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
