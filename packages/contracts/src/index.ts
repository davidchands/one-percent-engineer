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

/**
 * A short lesson shown BEFORE the challenge. Required for beginner (difficulty 1) challenges.
 * Order matters: the problem first, then why the concept exists, then how it works, then a
 * worked example, then a prediction you make before seeing the answer.
 */
export const Lesson = z.object({
  concept: z.string().describe("The ONE concept this lesson teaches"),
  realWorldProblem: z.string(),
  whyItExists: z.string(),
  howItWorks: z.string(),
  example: z.object({ code: z.string(), explanation: z.string() }),
  predict: z.object({
    code: z.string(),
    question: z.string(),
    answer: z.string(),
    why: z.string(),
  }),
  commonMistake: z.string(),
});
export type Lesson = z.infer<typeof Lesson>;

/** The answers a learner chooses between when they plan an interview-style problem. */
export const ComplexityClass = z.enum(["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(n × k)", "O(2ⁿ)"]);
export type ComplexityClass = z.infer<typeof ComplexityClass>;

/** Interview-style problems: the pattern and the cost of the best solution. Never sent to the client. */
export const InterviewMeta = z.object({
  /** The skill id of the technique that solves it, such as dsa.two-pointers. */
  pattern: z.string(),
  timeComplexity: ComplexityClass,
  spaceComplexity: ComplexityClass,
});
export type InterviewMeta = z.infer<typeof InterviewMeta>;

export const ChallengeMeta = z.object({
  id: z.string(),
  title: z.string(),
  type: ChallengeType,
  difficulty: z.number().int().min(1).max(5),
  /** Suggested order among challenges of the same difficulty (lower first). */
  sequence: z.number().int().optional(),
  skills: z.array(z.string()).min(1),
  targetLevel: Level,
  objective: z.string(),
  lesson: Lesson.optional(),
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
  interview: InterviewMeta.optional(),
  rubric: z.array(z.object({ criterion: z.string(), description: z.string() })),
});
export type ChallengeMeta = z.infer<typeof ChallengeMeta>;

/** What the client is allowed to see. No hidden tests, no solution. */
export const ChallengePublic = ChallengeMeta.omit({ hints: true, interview: true }).extend({
  hintCount: z.number().int(),
  /** Set for interview-style problems: what you can choose from when you plan before coding. */
  planOptions: z
    .object({
      patterns: z.array(z.object({ id: z.string(), name: z.string() })),
      complexities: z.array(ComplexityClass),
    })
    .nullable(),
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
  "plan_committed",
  "interview_started",
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

export const PlanRequest = z.object({
  pattern: z.string(),
  timeComplexity: ComplexityClass,
  spaceComplexity: ComplexityClass,
});
export type PlanRequest = z.infer<typeof PlanRequest>;

export const InterviewStartRequest = z.object({ minutes: z.number().int().min(5).max(120) });
export type InterviewStartRequest = z.infer<typeof InterviewStartRequest>;

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

/* ------------------------------------------------------------------ */
/* Build by Learning: projects (content/projects/<id>/)                */
/* See docs/BUILD-BY-LEARNING.md                                       */
/* ------------------------------------------------------------------ */

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids are kebab-case, like first-route");

/** One choice on a decision card. Nothing here says "pick this": the learner decides. */
export const DecisionOption = z.object({
  id: Slug,
  name: z.string(),
  summary: z.string().describe("What it is, in one or two plain sentences"),
  strengths: z.array(z.string()).min(1),
  costs: z.array(z.string()).min(1),
  whenProsChooseIt: z.string(),
  /** New ideas this option makes you learn, as plain labels ("middleware"). */
  newIdeas: z.array(z.string()),
  /** Skill ids that help with this option; compared against the learner's evidence. */
  relatedSkills: z.array(z.string()).default([]),
  /** How well this option fits each criterion, 1 (poorly) to 5 (very well). Keys are criterion ids. */
  fit: z.record(z.string(), z.number().int().min(1).max(5)),
});
export type DecisionOption = z.infer<typeof DecisionOption>;

export const Decision = z.object({
  id: Slug,
  title: z.string(),
  /** The real problem that forces this choice, before any option is named. */
  problem: z.string(),
  /** What a sensible engineer weighs. The learner sets how much each one matters to them. */
  criteria: z.array(z.object({ id: Slug, label: z.string(), description: z.string() })).min(2),
  options: z.array(DecisionOption).min(2).max(4),
  /** What it costs to change your mind later, so the choice feels as heavy as it is. */
  costOfChangingLater: z.string(),
});
export type Decision = z.infer<typeof Decision>;

/** Per-option extras on a step: the same task, explained for the stack the learner chose. */
export const StepVariant = z.object({
  notes: z.string().describe("How this step works with this option"),
  example: z.object({ code: z.string(), explanation: z.string() }).optional(),
  /** Replaces the step's hints for this option. Same rules: gentle first, never the full solution. */
  hints: z.array(z.string()).min(3).optional(),
});
export type StepVariant = z.infer<typeof StepVariant>;

export const ProjectStep = z.object({
  id: Slug,
  title: z.string(),
  objective: z.string(),
  skills: z.array(z.string()).default([]),
  lesson: Lesson.optional(),
  /** What to build, as a situation in the project ("readers need to see the list"). */
  task: z.string(),
  requirements: z.array(z.string()).min(1),
  /** Decisions this step's notes and references depend on, in order. Must come earlier in the project. */
  dependsOn: z.array(Slug).default([]),
  /** Does the runner start the app before the checks? False for steps that only check files. */
  startsApp: z.boolean().default(true),
  hints: z.array(z.string()).min(3),
  /** Keyed by option id of a decision in dependsOn. */
  variants: z.record(z.string(), StepVariant).default({}),
  commonMistakes: z.array(z.string()),
  explanationCheckpoint: z.string(),
});
export type ProjectStep = z.infer<typeof ProjectStep>;

export const MilestoneItem = z.union([
  z.object({ step: Slug }).strict(),
  z.object({ decision: Slug }).strict(),
  z.object({ checkpoint: z.string() }).strict(),
]);
export type MilestoneItem = z.infer<typeof MilestoneItem>;

export const Milestone = z.object({
  id: Slug,
  title: z.string(),
  goal: z.string().describe("What works at the end of this milestone, from the user's point of view"),
  items: z.array(MilestoneItem).min(1),
});
export type Milestone = z.infer<typeof Milestone>;

export const ProjectMeta = z.object({
  id: Slug,
  title: z.string(),
  brief: z.string().describe("What the app is and who it's for, in plain words"),
  whatYouBuild: z.array(z.string()).min(1),
  /** Skills that make this project comfortable. Not a hard lock (that's decided by the app). */
  prerequisites: z.array(z.string()).default([]),
  milestones: z.array(Milestone).min(1),
});
export type ProjectMeta = z.infer<typeof ProjectMeta>;

/** Why the runner couldn't get as far as running the checks, if it couldn't. */
export const AppStartup = z.enum(["not_needed", "ok", "no_start_script", "exited", "timeout"]);
export type AppStartup = z.infer<typeof AppStartup>;

export const ProjectCheckResult = TestRunResult.extend({
  startup: AppStartup,
  /** The last part of what the app printed. Its own errors are the best clue when it won't start. */
  appOutput: z.string(),
});
export type ProjectCheckResult = z.infer<typeof ProjectCheckResult>;

export const StartProjectRequest = z.object({
  /** Absolute path for your project. Defaults to ~/Documents/1pe-projects/<project-id>. */
  folder: z.string().startsWith("/", "Use an absolute path, like /Users/you/Documents/reading-list").optional(),
});
export type StartProjectRequest = z.infer<typeof StartProjectRequest>;

export const DecideRequest = z.object({
  optionId: z.string(),
  /** Required: picking without a reason is guessing, not deciding. */
  reason: z.string().trim().min(30, "Say why in a sentence or two: what made this option fit you?"),
  /** How much each criterion matters to you: 0 (not at all) to 3 (a lot). */
  weights: z.record(z.string(), z.number().int().min(0).max(3)).default({}),
});
export type DecideRequest = z.infer<typeof DecideRequest>;

export const StepSubmitRequest = z.object({
  explanation: z.string().min(40, "Explain your reasoning in at least a few sentences."),
  usedOutsideHelp: z.boolean(),
});
export type StepSubmitRequest = z.infer<typeof StepSubmitRequest>;

export type * from "./api.ts";
