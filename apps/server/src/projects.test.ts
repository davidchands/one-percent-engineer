/** Integration tests for Build by Learning: real content, real project runner, in-memory database. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db.ts";
import { loadContent } from "./content.ts";
import * as projects from "./projects.ts";
import type { Ctx } from "./services.ts";

const content = loadContent();
const step = content.projects.get("reading-list")!.steps.get("first-route")!;

function fresh(): Ctx & { cleanup: () => void } {
  const projectsDir = mkdtempSync(join(tmpdir(), "1pe-projects-svc-"));
  return { db: openDb(":memory:"), content, projectsDir, cleanup: () => rmSync(projectsDir, { recursive: true, force: true }) };
}

const reason = "I want to see how HTTP really works before a library hides it from me.";

test("a project isn't started until you start it, and starting creates the folder with a README", () => {
  const ctx = fresh();
  try {
    const before = projects.getProjectView(ctx, "reading-list");
    assert.equal(before.started, false);
    assert.equal(before.next, null);
    assert.equal(before.suggestedFolder, join(ctx.projectsDir!, "reading-list"));

    const after = projects.startProject(ctx, "reading-list");
    assert.equal(after.started, true);
    assert.match(readFileSync(join(after.folder!, "README.md"), "utf8"), /# Reading list/);
    assert.deepEqual(after.next, { kind: "decision", id: "server-framework" }, "the first thing to do is the first decision");
    assert.equal(projects.startProject(ctx, "reading-list").folder, after.folder, "starting again is harmless");
  } finally {
    ctx.cleanup();
  }
});

test("a step is blocked until you've made the decision it depends on", () => {
  const ctx = fresh();
  try {
    projects.startProject(ctx, "reading-list");
    const view = projects.getStepView(ctx, "reading-list", "first-route");
    assert.equal(view.status, "blocked");
    assert.deepEqual(view.blockedBy.map((b) => b.id), ["server-framework"]);
    assert.throws(() => projects.startStepAttempt(ctx, "reading-list", "first-route"), /Make this decision first/);
  } finally {
    ctx.cleanup();
  }
});

test("deciding needs a real option and is written into your project as a decision record", () => {
  const ctx = fresh();
  try {
    assert.throws(() => projects.decide(ctx, "reading-list", "server-framework", { optionId: "node-http", reason, weights: {} }), /Start the project/);
    projects.startProject(ctx, "reading-list");
    assert.throws(() => projects.decide(ctx, "reading-list", "server-framework", { optionId: "koa", reason, weights: {} }), /isn't one of the options/);

    const v = projects.decide(ctx, "reading-list", "server-framework", { optionId: "node-http", reason, weights: { fundamentals: 3 } });
    assert.equal(v.chosen?.optionId, "node-http");
    assert.ok(v.recordPath?.endsWith("docs/decisions/0001-server-framework.md"));
    const record = readFileSync(v.recordPath!, "utf8");
    assert.match(record, /\*\*Node's built-in http module\.\*\* I want to see how HTTP really works/);
    assert.match(record, /See how it really works: matters a lot/);
  } finally {
    ctx.cleanup();
  }
});

test("full loop: decide → start step → hint → failing check → pass with your own project", async () => {
  const ctx = fresh();
  try {
    const { folder } = projects.startProject(ctx, "reading-list");
    projects.decide(ctx, "reading-list", "server-framework", { optionId: "node-http", reason, weights: {} });

    const attempt = projects.startStepAttempt(ctx, "reading-list", "first-route");
    assert.equal(projects.startStepAttempt(ctx, "reading-list", "first-route").id, attempt.id, "starting again resumes");
    assert.equal(projects.getStepView(ctx, "reading-list", "first-route").status, "in_progress");

    const hinted = projects.requestStepHint(ctx, attempt.id);
    assert.equal(hinted.hints[0], step.meta.variants["node-http"]!.hints![0], "hints come from the option you chose");

    const empty = await projects.runStepChecks(ctx, attempt.id);
    assert.equal(empty.startup, "no_start_script", "an empty folder can't start");

    cpSync(step.references.get("node-http")!, folder!, { recursive: true });
    const run = await projects.runStepChecks(ctx, attempt.id);
    assert.equal(run.failed, 0);
    assert.equal(projects.stepAttemptView(ctx, attempt.id).checkRuns, 2);

    const explanation = "Each request goes to one handler; I match the method and URL and always set a status and JSON header.";
    const res = await projects.submitStep(ctx, attempt.id, { explanation, usedOutsideHelp: false });
    assert.equal(res.allPassed, true);
    assert.equal(res.independence, "hinted");
    assert.equal(projects.getStepView(ctx, "reading-list", "first-route").status, "passed");
    assert.equal(projects.getProjectView(ctx, "reading-list").next, null, "nothing left in the draft project");
  } finally {
    ctx.cleanup();
  }
});

test("changing your mind keeps the history and marks steps built on the old choice for redoing", async () => {
  const ctx = fresh();
  try {
    const { folder } = projects.startProject(ctx, "reading-list");
    projects.decide(ctx, "reading-list", "server-framework", { optionId: "node-http", reason, weights: {} });
    const attempt = projects.startStepAttempt(ctx, "reading-list", "first-route");
    cpSync(step.references.get("node-http")!, folder!, { recursive: true });
    await projects.submitStep(ctx, attempt.id, { explanation: "x".repeat(40), usedOutsideHelp: false });

    const changed = projects.decide(ctx, "reading-list", "server-framework", {
      optionId: "express",
      reason: "I'd rather learn what most job listings ask for.",
      weights: {},
    });
    assert.equal(changed.history.length, 2);
    assert.match(readFileSync(changed.recordPath!, "utf8"), /## History/);
    assert.equal(projects.getStepView(ctx, "reading-list", "first-route").status, "redo");
    assert.notEqual(projects.startStepAttempt(ctx, "reading-list", "first-route").optionsKey, "node-http");
  } finally {
    ctx.cleanup();
  }
});

test("the reference solution is only shown when you ask, and asking is recorded", () => {
  const ctx = fresh();
  try {
    projects.startProject(ctx, "reading-list");
    projects.decide(ctx, "reading-list", "server-framework", { optionId: "express", reason, weights: {} });
    const attempt = projects.startStepAttempt(ctx, "reading-list", "first-route");
    assert.equal(attempt.reference, null);
    assert.throws(() => projects.revealReference(ctx, attempt.id, false), /explicit confirmation/);
    const shown = projects.revealReference(ctx, attempt.id, true);
    assert.ok(shown.reference?.some((f) => f.path === "server.js" && f.content.includes("express")));
  } finally {
    ctx.cleanup();
  }
});

test("the step view never includes hints you haven't asked for", () => {
  const ctx = fresh();
  try {
    projects.startProject(ctx, "reading-list");
    const view = projects.getStepView(ctx, "reading-list", "first-route") as unknown as Record<string, unknown>;
    assert.ok(!("hints" in view));
    assert.ok(!existsSync(join(ctx.projectsDir!, "reading-list", "docs")), "no decision record before deciding");
  } finally {
    ctx.cleanup();
  }
});
