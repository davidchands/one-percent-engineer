/**
 * WORKED EXAMPLE (implemented). Study this before writing mastery.js.
 *
 * Notice the style used throughout `core`:
 *  - Pure functions: same input → same output, no database, no clock, no network.
 *  - The caller passes in everything (including `now` elsewhere), so tests are trivial.
 *  - Rules are written as ordered, explicit checks, so you can read the policy.
 *
 * About the comments that start with `@`: they're JSDoc. JavaScript ignores them,
 * but they tell your editor (and the rest of the project) what shape each value has.
 * Hover over a function in VS Code to see them used. You'll learn the TypeScript
 * equivalent later (Phase 5).
 */

/**
 * @typedef {import("@1pe/contracts").Evidence} Evidence
 * @typedef {import("@1pe/contracts").Independence} Independence
 * @typedef {import("@1pe/contracts").Level} Level
 */

/**
 * @typedef {object} AttemptHelpSummary
 * @property {number | null} maxHintIndex  Highest hint index requested (0-based), or null if no hints.
 * @property {number} totalHints
 * @property {boolean} solutionViewed
 * @property {boolean} usedOutsideHelp      Self-reported at submit time: AI, Stack Overflow, a friend…
 */

/** Hints at or beyond this index give away implementation details. */
export const ASSISTED_HINT_INDEX = 3;

/**
 * @param {AttemptHelpSummary} h
 * @returns {Independence}
 */
export function classifyIndependence(h) {
  if (h.solutionViewed) return "solution_viewed";
  if (h.usedOutsideHelp) return "assisted";
  if (h.maxHintIndex !== null && h.maxHintIndex >= ASSISTED_HINT_INDEX) return "assisted";
  if (h.totalHints > 0) return "hinted";
  return "independent";
}

/**
 * @typedef {object} SubmissionOutcome
 * @property {string[]} skills
 * @property {Level} targetLevel
 * @property {boolean} allTestsPassed
 * @property {Independence} independence
 * @property {string | null} context
 * @property {number} attemptId
 */

/**
 * An evidence row before the database gives it an id and timestamp.
 * @typedef {Omit<Evidence, "id" | "createdAt">} NewEvidence
 */

/**
 * Turns one graded submission into evidence rows, one per skill.
 * Evidence records WHAT HAPPENED. It does not decide your level:
 * that is the job of projectSkillState (mastery.js), which weighs all evidence together.
 *
 * @param {SubmissionOutcome} o
 * @returns {NewEvidence[]}
 */
export function deriveEvidence(o) {
  const base = { context: o.context, refType: "attempt", refId: String(o.attemptId) };

  return o.skills.map((skillId) => {
    if (!o.allTestsPassed) {
      return { ...base, skillId, level: o.targetLevel, polarity: /** @type {const} */ (-1), kind: "failed_attempt" };
    }
    const kind = o.independence === "independent" ? "independent_solve" : "assisted_solve";
    const level =
      o.independence === "independent"
        ? o.targetLevel
        : o.independence === "solution_viewed"
          ? 1 // you've seen it done; that's exposure, not ability
          : Math.min(o.targetLevel, 3); // help caps the claim at "applies with help"
    return { ...base, skillId, level, polarity: /** @type {const} */ (1), kind };
  });
}
