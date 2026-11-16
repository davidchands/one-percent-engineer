/** Integration tests for the action layer: real content, real sandbox, in-memory database. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.ts";
import { loadContent } from "./content.ts";
import * as svc from "./services.ts";
import { parseTap } from "./runner.ts";

const content = loadContent();
const fresh = (): svc.Ctx => ({ db: openDb(":memory:"), content });

test("today picks a challenge and keeps the same plan all day", () => {
  const ctx = fresh();
  const a = svc.today(ctx);
  assert.ok(a.primary);
  assert.equal(svc.today(ctx).primary?.challenge.id, a.primary.challenge.id);
});

test("the client never receives hints, hidden tests or the solution up front", () => {
  const pub = svc.getChallengePublic(fresh(), "printing-cost") as Record<string, unknown>;
  for (const k of ["hints", "hiddenTests", "solution", "wrongSolutions"]) assert.ok(!(k in pub), `${k} leaked`);
});

test("full loop: start → hint → run → failing submit → passing submit → evidence", async () => {
  const ctx = fresh();
  const ch = content.challenges.get("printing-cost")!;
  const attempt = svc.startAttempt(ctx, ch.meta.id);
  assert.equal(svc.startAttempt(ctx, ch.meta.id).id, attempt.id, "starting again resumes the open attempt");

  const hinted = svc.requestHint(ctx, attempt.id);
  assert.equal(hinted.hints.length, 1);

  const run = await svc.runPublicTests(ctx, attempt.id, ch.starter);
  assert.ok(run.failed > 0);

  const explanation = "I applied the allowance first, then the per-job price, then double-sided rounding, then bulk.";
  const bad = await svc.submit(ctx, attempt.id, { code: ch.starter, explanation, usedOutsideHelp: false });
  assert.equal(bad.allPassed, false);
  assert.equal(bad.attempt.status, "in_progress", "a failed submission keeps the attempt open");

  const good = await svc.submit(ctx, attempt.id, { code: ch.solution, explanation, usedOutsideHelp: false });
  assert.equal(good.allPassed, true);
  assert.equal(good.independence, "hinted");
  assert.equal(good.attempt.status, "passed");

  const ev = svc.allEvidence(ctx);
  assert.equal(ev.filter((e) => e.polarity === -1).length, ch.meta.skills.length);
  assert.ok(ev.filter((e) => e.polarity === 1).every((e) => e.kind === "assisted_solve" && e.level <= 3));

  await assert.rejects(() => svc.runPublicTests(ctx, attempt.id, ch.solution), /already passed/);
});

test("the sandbox kills infinite loops", async () => {
  const ctx = fresh();
  const a = svc.startAttempt(ctx, "printing-cost");
  const r = await svc.runPublicTests(ctx, a.id, "export function calculatePrintingCost(){ while(true){} }");
  assert.equal(r.timedOut, true);
  assert.equal(r.passed, 0);
});

test("viewing the solution needs confirmation and is recorded", async () => {
  const ctx = fresh();
  const a = svc.startAttempt(ctx, "inventory-stock");
  assert.throws(() => svc.revealSolution(ctx, a.id, false));
  assert.ok(svc.revealSolution(ctx, a.id, true).solution);
  const ch = content.challenges.get("inventory-stock")!;
  const r = await svc.submit(ctx, a.id, {
    code: ch.solution,
    explanation: "Check the whole order first, then mutate, so a failure never leaves partial state.",
    usedOutsideHelp: false,
  });
  assert.equal(r.independence, "solution_viewed");
});

test("journal entries are searchable by any field, with prefix matching", () => {
  const ctx = fresh();
  svc.createJournal(ctx, {
    title: "Printing cost",
    attemptId: null,
    fields: { ...emptyFields(), learned: "Integer cents avoid floating-point drift" },
    tags: ["money"],
  });
  assert.equal(svc.listJournal(ctx, "floating").length, 1);
  assert.equal(svc.listJournal(ctx, "flo").length, 1, "prefix search");
  assert.equal(svc.listJournal(ctx, 'weird "quotes').length, 0, "user input can't break FTS syntax");
});

test("TAP parser reads names and failure messages", () => {
  const tap = "ok 1 - adds\nnot ok 2 - fails\n  ---\n  error: 'boom'\n  ...\n";
  assert.deepEqual(parseTap(tap, false), [
    { name: "adds", passed: true, hidden: false, message: undefined },
    { name: "fails", passed: false, hidden: false, message: "boom" },
  ]);
});

function emptyFields() {
  return {
    problem: "",
    interpretation: "",
    initialIdea: "",
    alternatives: "",
    choiceAndWhy: "",
    errors: "",
    debugging: "",
    learned: "",
    differently: "",
    stillUnclear: "",
    beginnerExplanation: "",
  };
}
