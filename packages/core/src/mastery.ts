/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  YOUR TASK (M1-a): implement projectSkillState                   ║
 * ║  Spec: mastery.test.ts. Run it with:  pnpm test:core             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * This is the heart of 1% Engineer. Every module (dashboard, selector, AI mentor,
 * career readiness) trusts this function's answer to "what can I actually do?".
 * Get it honest, not generous.
 *
 * INPUT:  all evidence rows for ONE skill (any order), and `now`.
 * OUTPUT: the skill's current state.
 *
 * THE RULES (the tests check each one):
 *
 *  R1  No evidence → level 0, confidence 0, justifiedBy [].
 *  R2  Explanation evidence alone can reach at most level 2.
 *  R3  Assisted solves can reach at most level 3, however many there are.
 *  R4  ONE independent solve is not mastery: it reaches level 3.
 *      Level 4 needs independent solves on at least 2 different calendar days (UTC).
 *  R5  Level 5 (transfer) needs, on top of R4, an independent solve that is
 *        (a) at least 7 days after the previous positive evidence for this skill, AND
 *        (b) in a context not seen in any earlier evidence for this skill.
 *  R6  Two failed attempts in a row as the MOST RECENT evidence lower the level by 1.
 *  R7  Confidence decays with time since the last evidence: a state whose last
 *      evidence was 30 days ago has lower confidence than one from 1 day ago.
 *      Confidence is always within [0, 1].
 *  R8  justifiedBy lists the ids of the evidence rows that earned the level.
 *  R9  Deterministic: never call Date.now(); use the `now` argument.
 *  R10 Set implemented: true once you've replaced the placeholder.
 *
 * Also return nextReviewAt (ISO string or null). Simple first version:
 * lastEvidenceAt + (2^level) days. (FSRS can replace this later.)
 *
 * BEFORE CODING (write these in your journal, not here):
 *  - Which rule is the hardest? Why?
 *  - Will you sort the evidence first? By what?
 *  - How will you count "different calendar days"? What's the trap with time zones?
 *  - What does "a context not seen in earlier evidence" mean when context is null?
 *  - Sketch the confidence formula. Why that shape of decay?
 *
 * Ask for hints in chat if you get stuck. Hints first, never the full solution.
 */
import type { Evidence, SkillState } from "@1pe/contracts";

export function projectSkillState(skillId: string, evidence: Evidence[], now: Date): SkillState {
  // PLACEHOLDER: replace this whole body. It ignores all evidence on purpose.
  void evidence;
  void now;
  return {
    skillId,
    level: 0,
    confidence: 0,
    lastEvidenceAt: null,
    nextReviewAt: null,
    justifiedBy: [],
    implemented: false,
  };
}
