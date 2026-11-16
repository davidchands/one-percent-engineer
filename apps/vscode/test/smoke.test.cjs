/**
 * End-to-end smoke test for the extension, without launching VS Code.
 *
 * It bundles the REAL extension, loads it with a fake `vscode` module (fake-vscode.cjs), and
 * drives the commands against a REAL server started on a free port with a throwaway database
 * and practice folder. Nothing touches your actual data or ~/Documents/1pe-practice.
 *
 * Run: pnpm --filter one-percent-engineer test
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { buildSync } = require("esbuild");
const { createFakeVscode, attachFakeWebview, memento } = require("./fake-vscode.cjs");

const EXT_DIR = path.resolve(__dirname, "..");
const REPO = path.resolve(EXT_DIR, "../..");
const CHALLENGES = path.join(REPO, "content/challenges");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "1pe-smoke-"));
const practice = path.join(tmp, "practice");
let server;
let port;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolves with "done", or "timed out" if the promise doesn't settle within ms. */
const within = (promise, ms) => Promise.race([promise.then(() => "done"), wait(ms).then(() => "timed out")]);

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

async function waitForServer(url, ms = 15_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await wait(150);
  }
  throw new Error(`server did not start at ${url}`);
}

before(async () => {
  port = await freePort();
  server = spawn(path.join(EXT_DIR, "node_modules/.bin/tsx"), [path.join(REPO, "apps/server/src/server.ts")], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(tmp, "test.sqlite"),
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  server.stderr.on("data", (d) => (stderr += d));
  try {
    await waitForServer(`http://127.0.0.1:${port}/api/health`);
  } catch (e) {
    throw new Error(`${e.message}\n${stderr}`);
  }
});

after(() => {
  server?.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Bundles src/extension.ts and loads it with the fake vscode module in place of the real one. */
function loadExtension(vscode) {
  const outfile = path.join(tmp, `extension-${Date.now()}.cjs`);
  buildSync({
    entryPoints: [path.join(EXT_DIR, "src/extension.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["vscode"],
    outfile,
    logLevel: "error",
  });
  const originalLoad = Module._load;
  Module._load = function (request, ...rest) {
    return request === "vscode" ? vscode : originalLoad.call(this, request, ...rest);
  };
  try {
    return require(outfile);
  } finally {
    Module._load = originalLoad;
  }
}

test("daily loop through the extension", async (t) => {
  const config = {
    serverUrl: `http://127.0.0.1:${port}`,
    webUrl: "http://127.0.0.1:5173",
    challengesDir: practice,
    trackingEnabled: true,
  };
  const { vscode, rec } = createFakeVscode(config);
  const ext = loadExtension(vscode);
  const context = { subscriptions: [], extensionUri: { fsPath: EXT_DIR }, workspaceState: memento(), globalState: memento() };

  ext.activate(context);
  t.after(() => context.subscriptions.forEach((d) => d.dispose?.()));
  const view = attachFakeWebview(rec.viewProvider);
  const cmd = (id) => rec.commands[id]();

  let id, dir, sol;

  await t.test("the sidebar loads today's challenge", async () => {
    for (let i = 0; i < 50 && view.latest()?.status !== "ready"; i++) await wait(100);
    assert.equal(view.latest()?.status, "ready");
    id = view.latest().challenge.id;
    dir = path.join(practice, id);
    sol = path.join(dir, "solution.mjs");
  });

  await t.test("start creates the challenge files only inside the practice folder", async () => {
    await cmd("onePercent.start");
    for (const f of ["solution.mjs", "public.test.mjs", "package.json"]) assert.ok(fs.existsSync(path.join(dir, f)), `${f} exists`);
    assert.ok(fs.existsSync(path.join(practice, ".vscode/settings.json")), "AI-completions-off settings exist");
    assert.match(fs.readFileSync(sol, "utf8"), /<1pe:task id="/);
    assert.deepEqual(fs.readdirSync(tmp).filter((f) => !/^(practice|test\.sqlite.*|extension-.*)$/.test(f)), [], "nothing written elsewhere");
  });

  await t.test("first edit is recorded for the challenge file, and only that file", async () => {
    rec.onChange({ document: { uri: { fsPath: path.join(tmp, "other.js") } }, contentChanges: [{}] });
    await wait(200);
    const firstEdit = () => view.latest().attempt.metrics.find((m) => m.key === "timeToFirstEdit").valueMs;
    assert.equal(firstEdit(), null, "edits elsewhere are ignored");
    rec.onChange({ document: { uri: { fsPath: sol } }, contentChanges: [{}] });
    for (let i = 0; i < 30 && firstEdit() == null; i++) await wait(100);
    assert.notEqual(firstEdit(), null);
  });

  await t.test("starting again never overwrites your solution", async () => {
    fs.writeFileSync(sol, "// my work\n" + fs.readFileSync(sol, "utf8"));
    await cmd("onePercent.start");
    assert.ok(fs.readFileSync(sol, "utf8").startsWith("// my work"));
  });

  await t.test("run tests reports the starter's failures", async () => {
    await cmd("onePercent.runTests");
    const run = view.latest().lastRun;
    assert.ok(run.failed > 0 && run.cases.every((c) => !c.hidden), "visible tests only");
  });

  await t.test("hints and the thinking timer work", async () => {
    await cmd("onePercent.hint");
    assert.equal(view.latest().attempt.hints.length, 1);
    await cmd("onePercent.toggleTimer");
    assert.ok(view.latest().attempt.metrics.find((m) => m.key === "thinking").runningSince);
    await cmd("onePercent.toggleTimer");
    assert.equal(view.latest().attempt.metrics.find((m) => m.key === "thinking").runningSince, null);
  });

  await t.test("a passing submit finishes even while the 'Passed' notification is still open", async () => {
    // Regression: submit awaited a non-modal notification, leaving the panel stuck on "Submitting…".
    fs.writeFileSync(sol, fs.readFileSync(path.join(CHALLENGES, id, "solution.mjs"), "utf8"));
    rec.answers.input.push("I fixed each root cause separately and verified every fix against a failing case first.");
    rec.answers.quick.push("No, only 1% Engineer hints");
    assert.equal(await within(cmd("onePercent.submit"), 5000), "done", "submit must not hang");
    const s = view.latest();
    assert.equal(s.busy, null, "panel is not stuck on Submitting…");
    assert.equal(s.attempt.status, "passed");
    assert.equal(s.attempt.independence, "hinted");
    assert.ok(rec.info.some((m) => m.startsWith("Passed")), "the notification was still shown");
  });

  await t.test("the task comment asks first, and applies one undoable edit", async () => {
    vscode.window.activeTextEditor = {
      document: { uri: { fsPath: "/project/a.js" }, getText: () => "const a = 1;\n", positionAt: (n) => n },
    };
    await cmd("onePercent.insertTaskComment"); // no answer queued → cancelled
    assert.equal(rec.edits.length, 0, "nothing applied without confirmation");
    rec.answers.modal.push("Insert");
    await cmd("onePercent.insertTaskComment");
    assert.equal(rec.edits.length, 1);
    assert.match(rec.edits[0].ops[0].text, /<1pe:task id="/);
  });

  await t.test("the collected-data report lists what was sent and what never is", async () => {
    await cmd("onePercent.showCollectedData");
    const report = rec.docs[rec.docs.length - 1].content;
    assert.match(report, /## Never collected/);
    assert.match(report, /submitted solution\.mjs/);
  });

  await t.test("no error messages were shown along the way", () => {
    assert.deepEqual(rec.errors, []);
  });
});
