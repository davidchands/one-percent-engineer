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

/* ------------------------------------------------------------------ */
/* Interview mode                                                      */
/* ------------------------------------------------------------------ */

const EXPLANATION = "I kept a Map of what I had seen so far, so each price needs one lookup instead of a search.";

test("interview problems offer a plan to make, and never leak the answer", () => {
  const pub = svc.getChallengePublic(fresh(), "pair-for-sale") as Record<string, unknown>;
  assert.ok(!("interview" in pub), "the answer is not in the public problem");
  const options = pub.planOptions as { patterns: { id: string }[]; complexities: string[] };
  assert.ok(options.patterns.some((p) => p.id === "dsa.two-pointers"));
  assert.ok(!options.patterns.some((p) => p.id === "dsa.complexity" || p.id.startsWith("js.")));
  assert.equal((svc.getChallengePublic(fresh(), "cart-total") as Record<string, unknown>).planOptions, null);
});

test("committing a plan reveals whether each part was right, once", () => {
  const ctx = fresh();
  const a = svc.startAttempt(ctx, "pair-for-sale");
  assert.equal(a.plan, null);
  const planned = svc.commitPlan(ctx, a.id, { pattern: "dsa.hash-maps", timeComplexity: "O(n)", spaceComplexity: "O(n)" });
  assert.equal(planned.plan?.patternCorrect, false);
  assert.equal(planned.plan?.timeCorrect, true);
  assert.equal(planned.plan?.spaceCorrect, false, "two pointers needs no extra memory");
  assert.equal(planned.plan?.answer.pattern, "dsa.two-pointers");
  assert.equal(planned.plan?.answer.spaceComplexity, "O(1)");
  assert.throws(() => svc.commitPlan(ctx, a.id, { pattern: "dsa.two-pointers", timeComplexity: "O(n)", spaceComplexity: "O(1)" }), /already committed/);
});

test("a plan needs an interview problem and a real technique", () => {
  const ctx = fresh();
  const plain = svc.startAttempt(ctx, "cart-total");
  assert.throws(() => svc.commitPlan(ctx, plain.id, { pattern: "dsa.hash-maps", timeComplexity: "O(n)", spaceComplexity: "O(1)" }), /no planning step/);
  const a = svc.startAttempt(ctx, "pair-for-sale");
  assert.throws(() => svc.commitPlan(ctx, a.id, { pattern: "js.loops", timeComplexity: "O(n)", spaceComplexity: "O(1)" }), /isn't a technique/);
});

test("the interview countdown starts once and records whether you finished in time", async () => {
  let clock = new Date("2026-03-01T10:00:00Z");
  const ctx: svc.Ctx = { db: openDb(":memory:"), content, now: () => clock };
  const a = svc.startAttempt(ctx, "pair-for-sale");
  const started = svc.startInterview(ctx, a.id, { minutes: 30 });
  assert.equal(started.interview?.minutes, 30);
  assert.equal(started.interview?.finishedWithin, null);
  assert.throws(() => svc.startInterview(ctx, a.id, { minutes: 45 }), /already running/);

  clock = new Date("2026-03-01T10:20:00Z");
  const ch = content.challenges.get("pair-for-sale")!;
  const r = await svc.submit(ctx, a.id, { code: ch.solution, explanation: EXPLANATION, usedOutsideHelp: false });
  assert.equal(r.allPassed, true);
  assert.equal(r.attempt.interview?.finishedWithin, true);

  const late: svc.Ctx = { db: openDb(":memory:"), content, now: () => clock };
  clock = new Date("2026-03-01T11:00:00Z");
  const b = svc.startAttempt(late, "pair-for-sale");
  svc.startInterview(late, b.id, { minutes: 30 });
  clock = new Date("2026-03-01T11:40:00Z");
  const r2 = await svc.submit(late, b.id, { code: ch.solution, explanation: EXPLANATION, usedOutsideHelp: false });
  assert.equal(r2.attempt.interview?.finishedWithin, false);
});

test("passed interview problems come back for review on a widening schedule", async () => {
  let clock = new Date("2026-03-01T10:00:00Z");
  const ctx: svc.Ctx = { db: openDb(":memory:"), content, now: () => clock };
  const ch = content.challenges.get("pair-for-sale")!;
  assert.deepEqual(svc.interviewOverview(ctx).review, []);

  const first = svc.startAttempt(ctx, ch.meta.id);
  svc.commitPlan(ctx, first.id, { pattern: "dsa.hash-maps", timeComplexity: "O(n)", spaceComplexity: "O(n)" });
  clock = new Date("2026-03-01T10:30:00Z");
  await svc.submit(ctx, first.id, { code: ch.solution, explanation: EXPLANATION, usedOutsideHelp: false });

  let o = svc.interviewOverview(ctx);
  assert.equal(o.review.length, 1);
  assert.equal(o.review[0]!.timesPassed, 1);
  assert.equal(o.review[0]!.due, false, "not due the moment you pass it");
  assert.equal(o.review[0]!.dueAt, "2026-03-02T10:30:00.000Z", "back after 1 day");

  clock = new Date("2026-03-02T11:00:00Z");
  assert.equal(svc.interviewOverview(ctx).review[0]!.due, true);

  const second = svc.startAttempt(ctx, ch.meta.id);
  await svc.submit(ctx, second.id, { code: ch.solution, explanation: EXPLANATION, usedOutsideHelp: false });
  o = svc.interviewOverview(ctx);
  assert.equal(o.review[0]!.timesPassed, 2);
  assert.equal(o.review[0]!.dueAt, "2026-03-05T11:00:00.000Z", "back after 3 days");
});

test("the pattern map counts how often you name each technique correctly", () => {
  const ctx = fresh();
  const a = svc.startAttempt(ctx, "pair-for-sale");
  svc.commitPlan(ctx, a.id, { pattern: "dsa.hash-maps", timeComplexity: "O(n)", spaceComplexity: "O(n)" });
  const b = svc.startAttempt(ctx, "best-week-sales");
  svc.commitPlan(ctx, b.id, { pattern: "dsa.sliding-window", timeComplexity: "O(n)", spaceComplexity: "O(1)" });

  const o = svc.interviewOverview(ctx);
  const two = o.patterns.find((p) => p.skillId === "dsa.two-pointers")!;
  assert.deepEqual([two.problems, two.plans, two.patternRight, two.timeRight, two.spaceRight], [1, 1, 0, 1, 0]);
  const window = o.patterns.find((p) => p.skillId === "dsa.sliding-window")!;
  assert.deepEqual([window.plans, window.patternRight, window.spaceRight], [1, 1, 1]);
  assert.equal(o.weakestPatterns[0]?.skillId, "dsa.two-pointers");
  assert.ok(o.patterns.every((p) => p.skillId !== "dsa.complexity"));
});
