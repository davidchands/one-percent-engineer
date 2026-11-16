/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  YOUR TASK (M1-b): implement selectNextActivity                  ║
 * ║  Spec: selector.test.js. Do mastery.js first; this depends on it.║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Plain JavaScript. Decides today's ONE primary activity, and explains why with evidence.
 *
 * INPUT (one object):
 *   candidates  array of { id, title, skills: ["js.loops", …], targetLevel, difficulty }
 *   graph       Map from skill id → skill node { id, prerequisites: [...], careerRelevance, … }
 *   states      Map from skill id → skill state { level, justifiedBy: [...], … }  (from mastery.js)
 *   passedIds   Set of challenge ids you've already passed
 *
 * OUTPUT: null, or { activityId, rationale: { summary, evidenceIds, gap, expectedOutcome, howMeasured, isPlaceholder } }
 *
 * A skill with no entry in `states` counts as level 0.
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

/**
 * @typedef {import("@1pe/contracts").Rationale} Rationale
 * @typedef {import("@1pe/contracts").SkillNode} SkillNode
 * @typedef {import("@1pe/contracts").SkillState} SkillState
 * @typedef {import("@1pe/contracts").Level} Level
 */

/**
 * @typedef {object} Candidate
 * @property {string} id
 * @property {string} title
 * @property {string[]} skills
 * @property {Level} targetLevel
 * @property {number} difficulty
 */

/**
 * @typedef {object} SelectionInput
 * @property {Candidate[]} candidates
 * @property {Map<string, SkillNode>} graph
 * @property {Map<string, SkillState>} states
 * @property {Set<string>} passedIds
 */

/**
 * @typedef {object} Selection
 * @property {string} activityId
 * @property {Rationale} rationale
 */

/**
 * @param {SelectionInput} input
 * @returns {Selection | null}
 */
export function selectNextActivity(input) {
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
