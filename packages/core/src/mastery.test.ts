/**
 * SPEC for projectSkillState. These tests FAIL until you implement mastery.ts.
 * Don't edit the tests to make them pass. If you think a rule is wrong,
 * argue it in your journal and with me first, then change the rule AND the test together.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evidence, EvidenceKind } from "@1pe/contracts";
import { projectSkillState } from "./mastery.ts";

const SKILL = "js.loops";
let nextId = 1;
function ev(kind: EvidenceKind, isoDate: string, opts: Partial<Evidence> = {}): Evidence {
  return {
    id: nextId++,
    skillId: SKILL,
    level: 4,
    polarity: kind === "failed_attempt" ? -1 : 1,
    kind,
    context: "retail",
    refType: "attempt",
    refId: "x",
    createdAt: new Date(isoDate).toISOString(),
    ...opts,
  };
}
const NOW = new Date("2026-12-01T12:00:00Z");

test("R10 the placeholder has been replaced", () => {
  assert.equal(projectSkillState(SKILL, [], NOW).implemented, true);
});

test("R1 no evidence → level 0, confidence 0", () => {
  const s = projectSkillState(SKILL, [], NOW);
  assert.equal(s.level, 0);
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.justifiedBy, []);
});

test("R2 explanations alone cap at level 2", () => {
  const s = projectSkillState(
    SKILL,
    [ev("explanation", "2026-11-20", { level: 5 }), ev("explanation", "2026-11-25", { level: 5 })],
    NOW,
  );
  assert.equal(s.level, 2);
});

test("R3 many assisted solves still cap at level 3", () => {
  const s = projectSkillState(
    SKILL,
    ["2026-11-01", "2026-11-05", "2026-11-10", "2026-11-15"].map((d) => ev("assisted_solve", d)),
    NOW,
  );
  assert.equal(s.level, 3);
});

test("R4 one independent solve reaches 3, not 4", () => {
  const s = projectSkillState(SKILL, [ev("independent_solve", "2026-11-28")], NOW);
  assert.equal(s.level, 3);
});

test("R4 two independent solves on the SAME day still don't reach 4", () => {
  const s = projectSkillState(
    SKILL,
    [ev("independent_solve", "2026-11-28T09:00:00Z"), ev("independent_solve", "2026-11-28T18:00:00Z")],
    NOW,
  );
  assert.equal(s.level, 3);
});

test("R4 independent solves on two different days reach 4", () => {
  const s = projectSkillState(
    SKILL,
    [ev("independent_solve", "2026-11-27"), ev("independent_solve", "2026-11-28")],
    NOW,
  );
  assert.equal(s.level, 4);
});

test("R5 transfer needs a NEW context at least 7 days later", () => {
  const base = [ev("independent_solve", "2026-11-01"), ev("independent_solve", "2026-11-02")];

  const sameContext = projectSkillState(SKILL, [...base, ev("independent_solve", "2026-11-20")], NOW);
  assert.equal(sameContext.level, 4, "same context is repetition, not transfer");

  const tooSoon = projectSkillState(
    SKILL,
    [...base, ev("independent_solve", "2026-11-04", { context: "healthcare" })],
    NOW,
  );
  assert.equal(tooSoon.level, 4, "2 days later is still short-term memory");

  const transfer = projectSkillState(
    SKILL,
    [...base, ev("independent_solve", "2026-11-20", { context: "healthcare" })],
    NOW,
  );
  assert.equal(transfer.level, 5);
});

test("R6 two most-recent failures drop the level by one", () => {
  const s = projectSkillState(
    SKILL,
    [
      ev("independent_solve", "2026-11-01"),
      ev("independent_solve", "2026-11-02"),
      ev("failed_attempt", "2026-11-25"),
      ev("failed_attempt", "2026-11-26"),
    ],
    NOW,
  );
  assert.equal(s.level, 3);
});

test("R6 a failure followed by a success does not drop the level", () => {
  const s = projectSkillState(
    SKILL,
    [
      ev("independent_solve", "2026-11-01"),
      ev("independent_solve", "2026-11-02"),
      ev("failed_attempt", "2026-11-25"),
      ev("independent_solve", "2026-11-26"),
    ],
    NOW,
  );
  assert.equal(s.level, 4);
});

test("R7 confidence decays with time and stays within [0, 1]", () => {
  const recent = projectSkillState(SKILL, [ev("independent_solve", "2026-11-30")], NOW);
  const old = projectSkillState(SKILL, [ev("independent_solve", "2026-11-01")], NOW);
  assert.ok(recent.confidence > old.confidence, "older evidence should be less trustworthy");
  for (const s of [recent, old]) assert.ok(s.confidence >= 0 && s.confidence <= 1);
});

test("R8 justifiedBy points at real evidence", () => {
  const rows = [ev("independent_solve", "2026-11-27"), ev("independent_solve", "2026-11-28")];
  const s = projectSkillState(SKILL, rows, NOW);
  assert.ok(s.justifiedBy.length > 0);
  const ids = new Set(rows.map((r) => r.id));
  assert.ok(s.justifiedBy.every((id) => ids.has(id)));
});

test("R9 input order doesn't matter and nothing reads the real clock", () => {
  const rows = [ev("independent_solve", "2026-11-28"), ev("independent_solve", "2026-11-27")];
  const a = projectSkillState(SKILL, rows, NOW);
  const b = projectSkillState(SKILL, [...rows].reverse(), NOW);
  assert.deepEqual(a, b);
});
