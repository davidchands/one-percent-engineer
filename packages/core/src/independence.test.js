import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyIndependence, deriveEvidence } from "./independence.js";

const none = { maxHintIndex: null, totalHints: 0, solutionViewed: false, usedOutsideHelp: false };

test("no help at all is independent", () => {
  assert.equal(classifyIndependence(none), "independent");
});

test("a gentle hint makes it hinted, not assisted", () => {
  assert.equal(classifyIndependence({ ...none, maxHintIndex: 0, totalHints: 1 }), "hinted");
});

test("implementation-level hints make it assisted", () => {
  assert.equal(classifyIndependence({ ...none, maxHintIndex: 3, totalHints: 4 }), "assisted");
});

test("self-reported outside help makes it assisted even with no hints", () => {
  assert.equal(classifyIndependence({ ...none, usedOutsideHelp: true }), "assisted");
});

test("viewing the solution overrides everything", () => {
  assert.equal(classifyIndependence({ ...none, solutionViewed: true, usedOutsideHelp: true }), "solution_viewed");
});

test("a failed submission produces negative evidence for every skill", () => {
  const ev = deriveEvidence({
    skills: ["js.loops", "js.conditionals"],
    targetLevel: 4,
    allTestsPassed: false,
    independence: "independent",
    context: "retail",
    attemptId: 7,
  });
  assert.equal(ev.length, 2);
  assert.ok(ev.every((e) => e.polarity === -1 && e.kind === "failed_attempt"));
});

test("help caps the evidence level at 3", () => {
  const [e] = deriveEvidence({
    skills: ["js.loops"],
    targetLevel: 4,
    allTestsPassed: true,
    independence: "hinted",
    context: null,
    attemptId: 1,
  });
  assert.equal(e?.level, 3);
  assert.equal(e?.kind, "assisted_solve");
});
