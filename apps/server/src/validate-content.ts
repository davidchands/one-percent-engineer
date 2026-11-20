/**
 * Content quality gate. Run: pnpm validate:content
 *
 * A challenge is only trustworthy if its tests can tell right from wrong. For every challenge:
 *   1. challenge.yaml matches the schema and references real skills (done by loadContent)
 *   2. the reference solution passes ALL public + hidden tests
 *   3. the starter code FAILS (otherwise there's nothing to do)
 *   4. every plausible wrong solution in wrong/ fails at least one test
 *      (this proves the hidden tests actually catch the common mistakes)
 *
 * Build by Learning project steps (docs/BUILD-BY-LEARNING.md) get the same treatment:
 *   5. every reference snapshot (one per combination of chosen options) passes the step's checks
 *   6. the snapshot from BEFORE the step fails them, so the step really asks for something new
 *   7. every wrong/ snapshot fails at least one check
 *
 * AI-generated challenges (M6) will go through exactly this gate before you ever see them.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_DIR, loadContent, referenceKeys, type LoadedProject, type LoadedStep } from "./content.ts";
import { runProjectChecks } from "./project-runner.ts";
import { runTests } from "./runner.ts";

const content = loadContent();
let problems = 0;
const fail = (id: string, msg: string) => {
  problems++;
  console.log(`  ✗ ${id}: ${msg}`);
};

console.log(`Validating ${content.skills.size} skills and ${content.challenges.size} challenges…\n`);

for (const ch of content.challenges.values()) {
  const suites = { publicTests: ch.publicTests, hiddenTests: ch.hiddenTests };
  const id = ch.meta.id;
  const problemsBefore = problems;

  const ref = await runTests(ch.solution, suites);
  if (ref.failed > 0 || ref.passed === 0) {
    fail(id, `reference solution fails: ${ref.cases.filter((c) => !c.passed).map((c) => c.name).join(", ")}`);
  }
  if (!ref.cases.some((c) => c.hidden)) fail(id, "no hidden tests");

  const starter = await runTests(ch.starter, suites);
  if (starter.failed === 0) fail(id, "starter code already passes every test");

  if (ch.wrongSolutions.length === 0) fail(id, "no wrong/ solutions: can't prove the tests discriminate");
  for (const w of ch.wrongSolutions) {
    const r = await runTests(w.code, suites);
    if (r.failed === 0) fail(id, `wrong/${w.name} passes every test: the tests miss this mistake`);
  }

  if (ch.meta.hints.length < 3) fail(id, "needs at least 3 progressive hints");
  if (ch.meta.difficulty === 1 && !ch.meta.lesson) fail(id, "beginner (difficulty 1) challenges must include a lesson");
  console.log(`  ${problems > problemsBefore ? "·" : "✓"} ${id}  (${ref.passed} tests, ${ch.wrongSolutions.length} wrong solutions caught)`);
}

/* ------------------------------------------------------------------ */
/* Build by Learning projects                                          */
/* ------------------------------------------------------------------ */

/**
 * Snapshots run from a copy inside content/projects/.runs/, so the libraries in
 * content/projects/node_modules (express, fastify, ...) resolve, and nothing a run writes
 * (a data file, say) ends up in git.
 */
const RUNS_DIR = join(CONTENT_DIR, "projects", ".runs");

async function checkSnapshot(snapshot: string | null, step: LoadedStep) {
  mkdirSync(RUNS_DIR, { recursive: true });
  const dir = mkdtempSync(join(RUNS_DIR, `${step.meta.id}-`));
  try {
    if (snapshot) cpSync(snapshot, dir, { recursive: true, filter: (src) => !src.includes("node_modules") });
    return await runProjectChecks(dir, { acceptanceTests: step.acceptanceTests, startsApp: step.meta.startsApp });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The previous step's reference that matches these chosen options, or null (an empty project). */
function snapshotBefore(project: LoadedProject, stepId: string, key: string): string | null {
  const chosen = new Set(key === "default" ? [] : key.split("+"));
  const steps = project.order.filter((o) => o.kind === "step").map((o) => (o as { id: string }).id);
  const prevId = steps[steps.indexOf(stepId) - 1];
  if (!prevId) return null;
  const prev = project.steps.get(prevId)!;
  for (const [k, dir] of prev.references) {
    if (k === "default" || k.split("+").every((o) => chosen.has(o))) return dir;
  }
  return null;
}

if (content.projects.size) {
  const stepCount = [...content.projects.values()].reduce((n, p) => n + p.steps.size, 0);
  console.log(`\nValidating ${content.projects.size} project(s) with ${stepCount} step(s)…\n`);
}

for (const project of content.projects.values()) {
  for (const item of project.order) {
    if (item.kind !== "step") continue;
    const step = project.steps.get(item.id)!;
    const id = `${project.meta.id}/${step.meta.id}`;
    const problemsBefore = problems;

    const expected = referenceKeys(step.meta.dependsOn, project.decisions);
    for (const k of expected) if (!step.references.has(k)) fail(id, `no reference/${k}/ snapshot`);
    for (const k of step.references.keys()) if (!expected.includes(k)) fail(id, `reference/${k}/ doesn't match any combination of its dependsOn options`);

    let checks = 0;
    for (const [key, dir] of step.references) {
      if (!expected.includes(key)) continue;
      const ref = await checkSnapshot(dir, step);
      checks = Math.max(checks, ref.passed);
      if (ref.failed > 0 || ref.passed === 0) {
        const why = ref.cases.filter((c) => !c.passed).map((c) => `${c.name}${c.message ? ` (${c.message.split("\n")[0]})` : ""}`);
        fail(id, `reference/${key} fails: ${why.join(", ")}${ref.appOutput ? `\n      app output: ${ref.appOutput.split("\n").slice(-3).join(" | ")}` : ""}`);
      }
      const before = await checkSnapshot(snapshotBefore(project, step.meta.id, key), step);
      if (before.failed === 0) fail(id, `the project from before this step (${key}) already passes every check`);
    }

    if (step.wrong.length === 0) fail(id, "no wrong/ snapshots: can't prove the checks discriminate");
    for (const w of step.wrong) {
      const r = await checkSnapshot(w.dir, step);
      if (r.failed === 0) fail(id, `wrong/${w.name} passes every check: the checks miss this mistake`);
    }

    if (step.meta.hints.length < 3) fail(id, "needs at least 3 progressive hints");
    console.log(
      `  ${problems > problemsBefore ? "·" : "✓"} ${id}  (${checks} checks × ${step.references.size} option(s), ${step.wrong.length} wrong snapshots caught)`,
    );
  }
}

console.log(problems ? `\n${problems} problem(s) found.` : "\nAll content valid.");
process.exit(problems ? 1 : 0);
