/**
 * Runs a Build by Learning step's checks against a whole project (yours, or a reference snapshot).
 *
 *   1. read the `start` script from the project's package.json
 *   2. pick a free port and start the app with PORT set (the same convention hosting platforms use)
 *   3. wait until it answers on 127.0.0.1 or [::1]; if it exits first, report its own error output
 *   4. run the step's acceptance tests against it, with BASE_URL and PROJECT_DIR set
 *   5. stop the app and everything it started
 *
 * Checks test what the app DOES over HTTP (and which files exist), never how it's written, so one
 * set of checks works for every stack the learner might choose.
 *
 * Unlike the challenge sandbox (runner.ts) this is NOT locked down: a server needs the network and
 * may start processes. That's acceptable for the same reason as before: the only code it runs is
 * your own project, or the reference snapshots in this repo, on your own machine.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AppStartup, ProjectCheckResult, TestCaseResult } from "@1pe/contracts";
import { parseTap } from "./runner.ts";

export const STARTUP_TIMEOUT_MS = 10_000;
export const CHECKS_TIMEOUT_MS = 10_000;
const MAX_OUTPUT = 4_000;

export interface StepChecks {
  acceptanceTests: string;
  startsApp: boolean;
}

export async function runProjectChecks(projectDir: string, step: StepChecks): Promise<ProjectCheckResult> {
  const dir = realpathSync(projectDir);
  if (!step.startsApp) return finish(await runAcceptance(step.acceptanceTests, { PROJECT_DIR: dir }), "not_needed", "");

  const start = readStartScript(dir);
  if (!start) {
    return failure(
      "no_start_script",
      "the project has a start script",
      'Add a "start" script to package.json, for example "start": "node server.js".',
      "",
    );
  }

  const port = await freePort();
  const app = spawn("/bin/sh", ["-c", start], {
    cwd: dir,
    detached: true, // its own process group, so stopping it also stops anything it started
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      PATH: [join(dir, "node_modules", ".bin"), dirname(process.execPath), "/usr/local/bin", "/usr/bin", "/bin"].join(":"),
      HOME: process.env.HOME ?? "",
      PORT: String(port),
      NODE_ENV: "development",
    },
  });
  let output = "";
  const collect = (d: Buffer) => (output = (output + d).slice(-MAX_OUTPUT * 2));
  app.stdout!.on("data", collect);
  app.stderr!.on("data", collect);
  let exited = false;
  const exitedPromise = new Promise<void>((res) => app.on("exit", () => ((exited = true), res())));

  try {
    const baseUrl = await waitUntilAnswering(port, () => exited);
    if (!baseUrl) {
      return exited
        ? failure("exited", "the app starts and keeps running", `The app stopped before it answered on port ${port}. Its output is below.`, output)
        : failure(
            "timeout",
            "the app answers on the port it is given",
            `Nothing answered on port ${port} within ${STARTUP_TIMEOUT_MS / 1000}s. Does your server listen on process.env.PORT?`,
            output,
          );
    }
    const result = await runAcceptance(step.acceptanceTests, { BASE_URL: baseUrl, PROJECT_DIR: dir });
    return finish(result, "ok", output);
  } finally {
    await stop(app, exitedPromise, () => exited);
  }
}

function readStartScript(dir: string): string | null {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return null;
  try {
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { scripts?: Record<string, unknown> };
    const start = pkg.scripts?.start;
    return typeof start === "string" && start.trim() ? start : null;
  } catch {
    return null;
  }
}

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.once("error", rej);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => res(port));
    });
  });
}

/** Any HTTP answer counts, even a 404: it means something is listening. */
async function waitUntilAnswering(port: number, hasExited: () => boolean): Promise<string | null> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  // `listen(PORT, "localhost")` can bind only IPv6 on macOS, so try both loopback addresses.
  const candidates = [`http://127.0.0.1:${port}`, `http://[::1]:${port}`];
  while (Date.now() < deadline && !hasExited()) {
    for (const url of candidates) {
      try {
        await fetch(url + "/", { signal: AbortSignal.timeout(500) });
        return url;
      } catch {
        // not up yet
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

async function stop(app: ChildProcess, exitedPromise: Promise<void>, hasExited: () => boolean) {
  if (hasExited() || app.pid === undefined) return;
  const signal = (s: NodeJS.Signals) => {
    try {
      process.kill(-app.pid!, s);
    } catch {
      // already gone
    }
  };
  signal("SIGTERM");
  const timer = setTimeout(() => signal("SIGKILL"), 1_000);
  await exitedPromise;
  clearTimeout(timer);
  signal("SIGKILL"); // anything the app started that ignored SIGTERM
}

async function runAcceptance(source: string, env: Record<string, string>) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "1pe-checks-")));
  try {
    writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
    writeFileSync(join(dir, "acceptance.test.js"), source);
    const child = spawn(process.execPath, ["--no-warnings", "--test-reporter=tap", "acceptance.test.js"], {
      cwd: dir,
      env: { NODE_ENV: "test", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    let timedOut = false;
    const timer = setTimeout(() => ((timedOut = true), child.kill("SIGKILL")), CHECKS_TIMEOUT_MS);
    await new Promise<void>((res) => child.on("close", () => res()));
    clearTimeout(timer);

    const cases = parseTap(stdout, false);
    if (cases.length === 0) {
      cases.push({
        name: "checks could not run",
        passed: false,
        hidden: false,
        message: timedOut ? `The checks timed out after ${CHECKS_TIMEOUT_MS / 1000}s.` : stderr.trim().split("\n")[0]?.slice(0, 300),
      });
    }
    return { cases, timedOut, stderr: stderr.trim().slice(0, MAX_OUTPUT) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function finish(r: { cases: TestCaseResult[]; timedOut: boolean; stderr: string }, startup: AppStartup, appOutput: string): ProjectCheckResult {
  return {
    cases: r.cases,
    passed: r.cases.filter((c) => c.passed).length,
    failed: r.cases.filter((c) => !c.passed).length,
    timedOut: r.timedOut,
    stderr: r.stderr,
    startup,
    appOutput: appOutput.trim().slice(-MAX_OUTPUT),
  };
}

function failure(startup: AppStartup, name: string, message: string, appOutput: string): ProjectCheckResult {
  return finish({ cases: [{ name, passed: false, hidden: false, message }], timedOut: startup === "timeout", stderr: "" }, startup, appOutput);
}
