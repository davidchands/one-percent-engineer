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

test("code that finishes some tests and then hangs is a failure, not a pass", async () => {
  const { runTests } = await import("./runner.ts");
  const publicTests = [
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'import { f } from "./solution.js";',
    'test("small input", () => assert.equal(f(1), 1));',
    'test("big input", () => assert.equal(f(1e9), 1e9));',
  ].join("\n");
  const r = await runTests("export function f(n){ if (n > 5) { while(true){} } return n; }", { publicTests });
  assert.equal(r.timedOut, true);
  assert.ok(r.failed >= 1, "the unfinished work counts as a failure");
  assert.match(r.cases[0]!.message ?? "", /too slow/);
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

test("beginners start with the easiest challenge, in the suggested sequence", () => {
  const ctx = fresh();
  assert.equal(svc.today(ctx).primary?.challenge.id, "temperature-converter");
  const order = svc.listChallenges(ctx).map((c) => c.id);
  assert.deepEqual(order.slice(0, 5), ["temperature-converter", "ticket-price", "cart-total", "count-vowels", "password-strength"]);
});

test("lessons reach the client", () => {
  const pub = svc.getChallengePublic(fresh(), "temperature-converter");
  assert.ok(pub.lesson?.predict.answer, "lesson with a prediction is included");
});

test("no daily limit: passing today's challenge moves today on to the next one", async () => {
  const ctx = fresh();
  const first = svc.today(ctx).primary!.challenge.id;
  const ch = content.challenges.get(first)!;
  const a = svc.startAttempt(ctx, first);
  await svc.submit(ctx, a.id, {
    code: ch.solution,
    explanation: "I worked out the rule first, then wrote it as one expression and returned the result.",
    usedOutsideHelp: false,
  });
  const after = svc.today(ctx);
  assert.notEqual(after.primary?.challenge.id, first, "today offers a new challenge");
  assert.equal(after.primary?.passed, false);
  assert.deepEqual(after.stats.passedToday.map((c) => c.id), [first]);
  assert.equal(svc.today(ctx).primary?.challenge.id, after.primary?.challenge.id, "and it's stable until that one is passed");
});
