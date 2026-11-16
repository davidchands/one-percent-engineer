/**
 * WORKED EXAMPLE (implemented). Study this before writing mastery.ts.
 *
 * Notice the style used throughout `core`:
 *  - Pure functions: same input → same output, no database, no clock, no network.
 *  - The caller passes in everything (including `now` elsewhere), so tests are trivial.
 *  - Rules are written as ordered, explicit checks, so you can read the policy.
 */
import type { Evidence, Independence, EvidenceKind, Level } from "@1pe/contracts";

export interface AttemptHelpSummary {
  /** Highest hint index requested (0-based), or null if no hints were used. */
  maxHintIndex: number | null;
  totalHints: number;
  solutionViewed: boolean;
  /** Self-reported at submit time: AI, Stack Overflow, a friend, etc. */
  usedOutsideHelp: boolean;
}

/** Hints at or beyond this index give away implementation details. */
export const ASSISTED_HINT_INDEX = 3;

export function classifyIndependence(h: AttemptHelpSummary): Independence {
  if (h.solutionViewed) return "solution_viewed";
  if (h.usedOutsideHelp) return "assisted";
  if (h.maxHintIndex !== null && h.maxHintIndex >= ASSISTED_HINT_INDEX) return "assisted";
  if (h.totalHints > 0) return "hinted";
  return "independent";
}

export interface SubmissionOutcome {
  skills: string[];
  targetLevel: Level;
  allTestsPassed: boolean;
  independence: Independence;
  context: string | null;
  attemptId: number;
}

export type NewEvidence = Omit<Evidence, "id" | "createdAt">;

/**
 * Turns one graded submission into evidence rows, one per skill.
 * Evidence records WHAT HAPPENED. It does not decide your level:
 * that is the job of projectSkillState (mastery.ts), which weighs all evidence together.
 */
export function deriveEvidence(o: SubmissionOutcome): NewEvidence[] {
  const base = { context: o.context, refType: "attempt", refId: String(o.attemptId) };

  return o.skills.map((skillId): NewEvidence => {
    if (!o.allTestsPassed) {
      return { ...base, skillId, level: o.targetLevel, polarity: -1, kind: "failed_attempt" };
    }
    const kind: EvidenceKind = o.independence === "independent" ? "independent_solve" : "assisted_solve";
    const level: Level =
      o.independence === "independent"
        ? o.targetLevel
        : o.independence === "solution_viewed"
          ? 1 // you've seen it done; that's exposure, not ability
          : (Math.min(o.targetLevel, 3) as Level); // help caps the claim at "applies with help"
    return { ...base, skillId, level, polarity: 1, kind };
  });
}
