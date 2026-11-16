/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  YOUR TASK (M1-b): implement selectNextActivity                  ║
 * ║  Spec: selector.test.ts. Do mastery.ts first; this depends on it.║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Decides today's ONE primary activity, and explains why with evidence.
 *
 * THE RULES (the tests check each one):
 *
 *  S1  No candidates left (all passed, or none exist) → null.
 *  S2  Never pick a challenge you've already passed.
 *  S3  Prerequisites: a candidate whose skills have an unmet prerequisite
 *      (prerequisite skill below level 3) ranks below every candidate whose
 *      prerequisites are met.
 *  S4  Among ready candidates, prefer the biggest weighted gap:
 *        gap = max over the candidate's skills of
 *              (targetLevel − currentLevel) × careerRelevance
 *      Skills already at or above targetLevel contribute 0.
 *  S5  Ties: lower difficulty first, then id alphabetically (so it's deterministic).
 *  S6  The rationale must be real: isPlaceholder false, summary names the
 *      skill driving the choice, evidenceIds = that skill's justifiedBy.
 *
 * Later versions will add review urgency (nextReviewAt) and a recency penalty
 * for context domains. Leave those out for now.
 */
import type { Rationale, SkillNode, SkillState, Level } from "@1pe/contracts";

export interface Candidate {
  id: string;
  title: string;
  skills: string[];
  targetLevel: Level;
  difficulty: number;
}

export interface SelectionInput {
  candidates: Candidate[];
  graph: Map<string, SkillNode>;
  states: Map<string, SkillState>;
  passedIds: Set<string>;
}

export interface Selection {
  activityId: string;
  rationale: Rationale;
}

export function selectNextActivity(input: SelectionInput): Selection | null {
  // PLACEHOLDER: picks the first challenge you haven't passed. Replace it.
  const next = input.candidates.find((c) => !input.passedIds.has(c.id));
  if (!next) return null;
  return {
    activityId: next.id,
    rationale: {
      summary: `Placeholder selector: "${next.title}" is simply the next unpassed challenge in the list.`,
      evidenceIds: [],
      gap: "Unknown. The real selector (your M1-b task) will identify it from evidence.",
      expectedOutcome: `Pass all tests for "${next.title}" and explain why your solution works.`,
      howMeasured: "Hidden tests, hint usage and your explanation checkpoint.",
      isPlaceholder: true,
    },
  };
}
