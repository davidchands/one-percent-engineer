/** SPEC for selectNextActivity. These tests FAIL until you implement selector.ts. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SkillNode, SkillState } from "@1pe/contracts";
import { selectNextActivity, type Candidate } from "./selector.ts";

function node(id: string, prerequisites: string[] = [], careerRelevance = 0.5): SkillNode {
  return { id, name: id, domain: "js", phase: 1, why: "", prerequisites, careerRelevance, objectives: {} };
}
function state(skillId: string, level: number, justifiedBy: number[] = []): SkillState {
  return {
    skillId,
    level,
    confidence: 0.8,
    lastEvidenceAt: null,
    nextReviewAt: null,
    justifiedBy,
    implemented: true,
  };
}
function cand(id: string, skills: string[], targetLevel = 4, difficulty = 2): Candidate {
  return { id, title: id, skills, targetLevel, difficulty };
}

const graph = new Map(
  [
    node("js.variables", [], 0.5),
    node("js.loops", ["js.variables"], 0.6),
    node("js.arrays", ["js.loops"], 0.9),
  ].map((n) => [n.id, n]),
);

test("S1 returns null when nothing is left", () => {
  const r = selectNextActivity({ candidates: [cand("a", ["js.variables"])], graph, states: new Map(), passedIds: new Set(["a"]) });
  assert.equal(r, null);
});

test("S2 never picks a passed challenge", () => {
  const r = selectNextActivity({
    candidates: [cand("a", ["js.variables"]), cand("b", ["js.variables"])],
    graph,
    states: new Map(),
    passedIds: new Set(["a"]),
  });
  assert.equal(r?.activityId, "b");
});

test("S3 unmet prerequisites rank below ready candidates", () => {
  // arrays has the highest career relevance, but loops (its prerequisite) is only level 1.
  const states = new Map([["js.variables", state("js.variables", 4)], ["js.loops", state("js.loops", 1)]]);
  const r = selectNextActivity({
    candidates: [cand("arrays-1", ["js.arrays"]), cand("loops-1", ["js.loops"])],
    graph,
    states,
    passedIds: new Set(),
  });
  assert.equal(r?.activityId, "loops-1");
});

test("S4 prefers the biggest career-weighted gap", () => {
  const states = new Map([
    ["js.variables", state("js.variables", 3)],
    ["js.loops", state("js.loops", 3)],
    ["js.arrays", state("js.arrays", 0)],
  ]);
  const r = selectNextActivity({
    candidates: [cand("vars-1", ["js.variables"]), cand("arrays-1", ["js.arrays"])],
    graph,
    states,
    passedIds: new Set(),
  });
  assert.equal(r?.activityId, "arrays-1");
});

test("S5 ties break by difficulty, then id", () => {
  const r = selectNextActivity({
    candidates: [cand("z", ["js.variables"], 4, 2), cand("b", ["js.variables"], 4, 1), cand("a", ["js.variables"], 4, 1)],
    graph,
    states: new Map(),
    passedIds: new Set(),
  });
  assert.equal(r?.activityId, "a");
});

test("S6 the rationale is real and evidence-backed", () => {
  const states = new Map([["js.variables", state("js.variables", 2, [11, 12])]]);
  const r = selectNextActivity({ candidates: [cand("v", ["js.variables"])], graph, states, passedIds: new Set() });
  assert.equal(r?.rationale.isPlaceholder, false);
  assert.match(r?.rationale.summary ?? "", /js\.variables/);
  assert.deepEqual(r?.rationale.evidenceIds, [11, 12]);
});
