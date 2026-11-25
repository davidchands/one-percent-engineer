/**
 * Runs a challenge's tests against submitted code in a separate, restricted Node process.
 *
 * What the sandbox DOES protect against:
 *  - infinite loops (hard timeout, process killed)
 *  - writing to the file system (Node permission model: no --allow-fs-write)
 *  - reading files outside the temp folder (--allow-fs-read limited to it)
 *  - spawning processes / native addons / workers (not allowed by the permission model)
 *  - leaking your environment variables (env is replaced, not inherited)
 *
 * What it does NOT protect against (known limitation, write it down, fix later):
 *  - network access (Node 22's permission model doesn't restrict it)
 *  - memory exhaustion beyond the heap limit set below
 * This is acceptable because the only code it runs is code YOU wrote on YOUR machine.
 * Hardening this is a good Phase 5 security challenge.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestCaseResult, TestRunResult } from "@1pe/contracts";

const TIMEOUT_MS = 5_000;

export async function runTests(
  code: string,
  suites: { publicTests: string; hiddenTests?: string },
): Promise<TestRunResult> {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "1pe-run-")));
  try {
    // package.json marks .js files as modern JavaScript modules (import/export).
    writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
    writeFileSync(join(dir, "solution.js"), code);
    const runs = [runSuite(dir, "public.test.js", suites.publicTests, false)];
    if (suites.hiddenTests) runs.push(runSuite(dir, "hidden.test.js", suites.hiddenTests, true));
    const results = await Promise.all(runs);
    const cases = results.flatMap((r) => r.cases);
    return {
      cases,
      passed: cases.filter((c) => c.passed).length,
      failed: cases.filter((c) => !c.passed).length,
      timedOut: results.some((r) => r.timedOut),
      stderr: results.map((r) => r.stderr).filter(Boolean).join("\n").slice(0, 4000),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function runSuite(dir: string, file: string, source: string, hidden: boolean) {
  writeFileSync(join(dir, file), source);
  const child = spawn(
    process.execPath,
    [
      "--experimental-permission",
      `--allow-fs-read=${dir}`,
      "--max-old-space-size=128",
      "--no-warnings",
      "--test-reporter=tap",
      file,
    ],
    { cwd: dir, env: { NODE_ENV: "test" }, stdio: ["ignore", "pipe", "pipe"] },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stderr += d));

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, TIMEOUT_MS);
  await new Promise<void>((res) => child.on("close", () => res()));
  clearTimeout(timer);

  const cases = parseTap(stdout, hidden);
  if (cases.length === 0) {
    // Nothing ran: syntax error, missing export, timeout before any test finished...
    cases.push({
      name: timedOut
        ? `${hidden ? "hidden tests" : "tests"} ran out of time (${TIMEOUT_MS / 1000}s)`
        : hidden ? "hidden suite could not run" : "test suite could not run",
      passed: false,
      hidden,
      message: timedOut ? `Stopped after ${TIMEOUT_MS / 1000}s. Either an infinite loop, or code that is correct but too slow on a big input: look for work repeated for every item that could be done once.` : firstErrorLine(stderr),
    });
  }
  return { cases, timedOut, stderr: hidden ? "" : stderr.trim() };
}

/** Parses top-level TAP results from node:test. Exported for testing. */
export function parseTap(tap: string, hidden: boolean): TestCaseResult[] {
  const lines = tap.split("\n");
  const out: TestCaseResult[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(not )?ok \d+ - (.*)$/.exec(lines[i]!);
    if (!m) continue;
    const passed = !m[1];
    const name = m[2]!.replace(/ # (SKIP|TODO).*$/, "");
    let message: string | undefined;
    if (!passed && !hidden) message = extractError(lines, i + 1);
    out.push({ name, passed, hidden, message });
  }
  return out;
}

function extractError(lines: string[], start: number): string | undefined {
  for (let j = start; j < lines.length && !/^\S/.test(lines[j]!); j++) {
    const m = /^ {2}error: (.*)$/.exec(lines[j]!);
    if (!m) continue;
    if (m[1] !== "|-") return m[1]!.replace(/^'|'$/g, "");
    const body: string[] = [];
    for (let k = j + 1; k < lines.length && /^ {4}/.test(lines[k]!); k++) body.push(lines[k]!.slice(4));
    return body.join("\n").trim();
  }
  return undefined;
}

function firstErrorLine(stderr: string): string {
  const line = stderr.split("\n").find((l) => /Error|error/.test(l));
  return (line ?? stderr.split("\n")[0] ?? "Unknown error").trim().slice(0, 300);
}
