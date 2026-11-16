/**
 * Shared contracts for 1% Engineer.
 *
 * Every shape that crosses a boundary (content files → server, server → web,
 * later server ↔ VS Code extension and AI outputs → core) is defined here once,
 * as a Zod schema. Types are inferred from the schemas, so runtime validation
 * and compile-time types can never disagree.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Levels of understanding                                             */
/* ------------------------------------------------------------------ */

/**
 * 0 = no evidence yet
 * 1 = knows the definition
 * 2 = understands (can explain why)
 * 3 = applies with help
 * 4 = applies independently
 * 5 = transfers to an unfamiliar context (spaced, ≥7 days later)
 * 6 = makes engineering decisions with it (defends trade-offs)
 */
export const Level = z.number().int().min(0).max(6);
export type Level = z.infer<typeof Level>;

export const LEVEL_NAMES: Record<number, string> = {
  0: "No evidence",
  1: "Knows definition",
  2: "Understands",
  3: "Applies with help",
  4: "Applies independently",
  5: "Transfers",
  6: "Makes decisions",
};

/* ------------------------------------------------------------------ */
/* Skill graph (content/skills/*.yaml)                                 */
/* ------------------------------------------------------------------ */

export const SkillNode = z.object({
  id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, "ids look like js.closures"),
  name: z.string(),
  domain: z.string(),
  phase: z.number().int().min(1).max(6),
  why: z.string().describe("The real-world problem that created the need for this concept"),
  prerequisites: z.array(z.string()).default([]),
  careerRelevance: z.number().min(0).max(1).default(0.5),
  /** What evidence proves each level for THIS skill. Keys 1–6. */
  objectives: z.record(z.string(), z.string()),
});
export type SkillNode = z.infer<typeof SkillNode>;

/* ------------------------------------------------------------------ */
/* Challenges (content/challenges/<id>/challenge.yaml)                 */
/* ------------------------------------------------------------------ */

export const ChallengeType = z.enum([
  "implement",
  "debug",
  "comprehension",
  "algorithm",
  "design",
  "refactor",
  "open_ended",
]);
export type ChallengeType = z.infer<typeof ChallengeType>;

export const ChallengeMeta = z.object({
  id: z.string(),
  title: z.string(),
  type: ChallengeType,
  difficulty: z.number().int().min(1).max(5),
  skills: z.array(z.string()).min(1),
  targetLevel: Level,
  objective: z.string(),
  problem: z.string(),
  requirements: z.array(z.string()),
  constraints: z.array(z.string()),
  examples: z.array(z.object({ input: z.string(), output: z.string(), note: z.string().optional() })),
  edgeCasesToConsider: z.array(z.string()).describe("Prompts, not answers"),
  beforeCoding: z.array(z.string()),
  /** Progressive: index 0 is the gentlest nudge. The full solution is never a hint. */
  hints: z.array(z.string()).min(3),
  commonMistakes: z.array(z.string()),
  explanationCheckpoint: z.string(),
  rubric: z.array(z.object({ criterion: z.string(), description: z.string() })),
});
export type ChallengeMeta = z.infer<typeof ChallengeMeta>;

/** What the client is allowed to see. No hidden tests, no solution. */
export const ChallengePublic = ChallengeMeta.omit({ hints: true }).extend({
  hintCount: z.number().int(),
  starterCode: z.string(),
  publicTests: z.string(),
});
export type ChallengePublic = z.infer<typeof ChallengePublic>;

/* ------------------------------------------------------------------ */
/* Attempts, events, submissions                                       */
/* ------------------------------------------------------------------ */

export const Independence = z.enum(["independent", "hinted", "assisted", "solution_viewed"]);
export type Independence = z.infer<typeof Independence>;

export const AttemptStatus = z.enum(["in_progress", "passed", "failed", "abandoned"]);
export type AttemptStatus = z.infer<typeof AttemptStatus>;

/** Every metric says where it came from. Never pretend an inference is an observation. */
export const Provenance = z.enum(["observed", "manual", "inferred"]);
export type Provenance = z.infer<typeof Provenance>;

export const EventKind = z.enum([
  "attempt_started",
  "hint_requested",
  "test_run",
  "submission",
  "solution_viewed",
  "timer_start",
  "timer_pause",
  "first_edit",
]);
export type EventKind = z.infer<typeof EventKind>;

export const NewEvent = z.object({
  kind: EventKind,
  provenance: Provenance,
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type NewEvent = z.infer<typeof NewEvent>;

export const TestCaseResult = z.object({
  name: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
  /** Withheld for hidden tests: you get the category, not the input. */
  message: z.string().optional(),
});
export type TestCaseResult = z.infer<typeof TestCaseResult>;

export const TestRunResult = z.object({
  passed: z.number().int(),
  failed: z.number().int(),
  cases: z.array(TestCaseResult),
  timedOut: z.boolean(),
  stderr: z.string(),
});
export type TestRunResult = z.infer<typeof TestRunResult>;

export const RunRequest = z.object({ code: z.string().max(100_000) });

export const SubmitRequest = z.object({
  code: z.string().max(100_000),
  /** The explanation checkpoint. Required: code without reasoning is not evidence of understanding. */
  explanation: z.string().min(40, "Explain your reasoning in at least a few sentences."),
  /** Honest self-report. The system cannot see outside help. */
  usedOutsideHelp: z.boolean(),
});
export type SubmitRequest = z.infer<typeof SubmitRequest>;

/* ------------------------------------------------------------------ */
/* Evidence: the shared intelligence layer                            */
/* ------------------------------------------------------------------ */

export const EvidenceKind = z.enum([
  "independent_solve",
  "assisted_solve",
  "failed_attempt",
  "explanation",
  "delayed_recall",
  "transfer",
  "project_use",
  "interview",
  "self_report",
]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

/** Append-only. Skill state is always a projection of these rows. */
export const Evidence = z.object({
  id: z.number().int(),
  skillId: z.string(),
  level: Level,
  polarity: z.union([z.literal(1), z.literal(-1)]),
  kind: EvidenceKind,
  /** Context domain of the activity (e.g. "logistics"). Needed to detect transfer. */
  context: z.string().nullable(),
  refType: z.string(),
  refId: z.string(),
  createdAt: z.string().datetime(),
});
export type Evidence = z.infer<typeof Evidence>;

export const SkillState = z.object({
  skillId: z.string(),
  level: Level,
  /** 0–1. How much the evidence supports `level` right now (decays over time). */
  confidence: z.number().min(0).max(1),
  lastEvidenceAt: z.string().nullable(),
  nextReviewAt: z.string().nullable(),
  /** Evidence ids that justify the current level. "Why am I L3?" must always be answerable. */
  justifiedBy: z.array(z.number().int()),
  /** False while the projection is still the placeholder. */
  implemented: z.boolean(),
});
export type SkillState = z.infer<typeof SkillState>;

/* ------------------------------------------------------------------ */
/* Daily plan                                                          */
/* ------------------------------------------------------------------ */

export const Rationale = z.object({
  summary: z.string(),
  evidenceIds: z.array(z.number().int()),
  gap: z.string(),
  expectedOutcome: z.string(),
  howMeasured: z.string(),
  isPlaceholder: z.boolean(),
});
export type Rationale = z.infer<typeof Rationale>;

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export const JournalFields = z.object({
  problem: z.string().default(""),
  interpretation: z.string().default(""),
  initialIdea: z.string().default(""),
  alternatives: z.string().default(""),
  choiceAndWhy: z.string().default(""),
  errors: z.string().default(""),
  debugging: z.string().default(""),
  learned: z.string().default(""),
  differently: z.string().default(""),
  stillUnclear: z.string().default(""),
  beginnerExplanation: z.string().default(""),
});
export type JournalFields = z.infer<typeof JournalFields>;

export const NewJournalEntry = z.object({
  title: z.string().min(1),
  attemptId: z.number().int().nullable().default(null),
  fields: JournalFields,
  tags: z.array(z.string()).default([]),
});
export type NewJournalEntry = z.infer<typeof NewJournalEntry>;

export const JournalEntry = NewJournalEntry.extend({
  id: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JournalEntry = z.infer<typeof JournalEntry>;

export type * from "./api.ts";
