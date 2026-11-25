/**
 * Response shapes of the local HTTP API, shared by every client (web app, VS Code extension,
 * and later the AI chat). Plain interfaces: the server produces them, clients trust them.
 */
import type {
  Decision,
  Independence,
  JournalEntry,
  Lesson,
  ProjectCheckResult,
  Rationale,
  SkillNode,
  SkillState,
  TestRunResult,
} from "./index.ts";

export interface TodayResponse {
  date: string;
  primary: null | {
    challenge: {
      id: string;
      title: string;
      objective: string;
      type: string;
      difficulty: number;
      skills: string[];
      phase: number;
    };
    rationale: Rationale;
    passed: boolean;
    openAttemptId: number | null;
  };
  stats: {
    challengesPassed: number;
    challengesTotal: number;
    /** Challenges passed today, in order. There's no daily limit. */
    passedToday: { id: string; title: string }[];
    practicedDaysThisWeek: number;
    projectionImplemented: boolean;
  };
  weaknesses: { skillId: string; name: string; failures: number; last: string }[];
  reviews: { skillId: string; nextReviewAt: string | null }[];
  recentJournal: JournalEntry[];
}

export interface Metric {
  key: string;
  label: string;
  valueMs?: number | null;
  count?: number;
  provenance: "observed" | "manual" | "inferred";
  caveat: string;
  runningSince?: string | null;
}

export interface AttemptResponse {
  id: number;
  challengeId: string;
  status: "in_progress" | "passed" | "failed" | "abandoned";
  independence: Independence | null;
  startedAt: string;
  endedAt: string | null;
  hints: string[];
  hintCount: number;
  solution: string | null;
  lastSubmission: null | { code: string; explanation: string; results: TestRunResult; createdAt: string };
  metrics: Metric[];
  /** Interview-style problems only: what you planned before coding, and how it compared. */
  plan: PlanResult | null;
  /** The optional countdown. null if you didn't start one. */
  interview: InterviewTimer | null;
}

export interface PlanResult {
  pattern: string;
  timeComplexity: string;
  spaceComplexity: string;
  patternCorrect: boolean;
  timeCorrect: boolean;
  spaceCorrect: boolean;
  /** Revealed only after you commit. */
  answer: { pattern: string; patternName: string; timeComplexity: string; spaceComplexity: string };
  committedAt: string;
}

export interface InterviewTimer {
  minutes: number;
  startedAt: string;
  /** Known once the attempt passes. */
  finishedWithin: boolean | null;
}

export interface PatternRow {
  skillId: string;
  name: string;
  problems: number;
  passed: number;
  /** Plans you committed on this pattern, and how many named the pattern, the time and the space right. */
  plans: number;
  patternRight: number;
  timeRight: number;
  spaceRight: number;
  lastPracticed: string | null;
}

export interface ReviewItem {
  challengeId: string;
  title: string;
  pattern: string;
  /** How many times you've passed it. Each pass pushes the next review further out. */
  timesPassed: number;
  lastPassedAt: string;
  dueAt: string;
  due: boolean;
}

export interface InterviewOverview {
  patterns: PatternRow[];
  review: ReviewItem[];
  /** Pattern ids you most often mis-name when planning, worst first. */
  weakestPatterns: { skillId: string; name: string; missed: number; plans: number }[];
}

export interface AttemptSummary {
  id: number;
  status: string;
  independence: Independence | null;
  startedAt: string;
  endedAt: string | null;
}

export interface SkillRow extends SkillNode {
  state: SkillState;
  evidenceCount: number;
  failures: number;
}

export interface ChallengeRow {
  id: string;
  title: string;
  type: string;
  difficulty: number;
  skills: string[];
  passed: boolean;
}

export interface SubmitResponse {
  results: TestRunResult;
  allPassed: boolean;
  independence: Independence;
  attempt: AttemptResponse;
}

/* ------------------------------------------------------------------ */
/* Build by Learning                                                   */
/* ------------------------------------------------------------------ */

export interface ProjectSummary {
  id: string;
  title: string;
  brief: string;
  started: boolean;
  folder: string | null;
  progress: { stepsPassed: number; steps: number; decisionsMade: number; decisions: number };
}

export type StepStatus = "blocked" | "ready" | "in_progress" | "passed" | "redo";

export type RoadmapItem =
  | { kind: "decision"; id: string; title: string; chosen: { optionId: string; name: string } | null }
  | { kind: "step"; id: string; title: string; status: StepStatus; blockedBy: string[] }
  | { kind: "checkpoint"; prompt: string };

export interface ProjectView {
  id: string;
  title: string;
  brief: string;
  whatYouBuild: string[];
  started: boolean;
  folder: string | null;
  /** Where the folder will be created if you start now. */
  suggestedFolder: string;
  /** Not a lock: a heads-up about ideas you haven't practised in a challenge yet. */
  prerequisites: { id: string; name: string; practised: boolean }[];
  milestones: { id: string; title: string; goal: string; items: RoadmapItem[] }[];
  /** The first thing on the roadmap that isn't done. */
  next: { kind: "decision" | "step"; id: string } | null;
}

export interface DecisionChoice {
  optionId: string;
  reason: string;
  weights: Record<string, number>;
  decidedAt: string;
}

export interface DecisionView {
  projectId: string;
  /** Position in the project, used for the decision record's file name (0001-…). */
  number: number;
  decision: Decision;
  chosen: DecisionChoice | null;
  history: DecisionChoice[];
  /** Per option: which of its related skills you've practised in challenges, and which not yet. */
  readiness: Record<string, { practised: string[]; notYet: string[] }>;
  /** Steps built on this decision, and whether you've already passed them with your current choice. */
  affectedSteps: { id: string; title: string; passed: boolean }[];
  /** The decision record file in your project, once you've decided. */
  recordPath: string | null;
}

export interface StepAttemptView {
  id: number;
  stepId: string;
  status: string;
  independence: Independence | null;
  optionsKey: string;
  startedAt: string;
  endedAt: string | null;
  hints: string[];
  hintCount: number;
  checkRuns: number;
  lastCheck: ProjectCheckResult | null;
  lastSubmission: { explanation: string; results: ProjectCheckResult; createdAt: string } | null;
  /** Only after you've chosen to look. Viewing it is recorded. */
  reference: { path: string; content: string }[] | null;
}

export interface StepView {
  projectId: string;
  id: string;
  title: string;
  objective: string;
  lesson: Lesson | null;
  task: string;
  requirements: string[];
  /** Notes for the options you chose, e.g. how this step works with Express. */
  notes: { decisionTitle: string; optionName: string; notes: string; example: { code: string; explanation: string } | null }[];
  commonMistakes: string[];
  explanationCheckpoint: string;
  startsApp: boolean;
  acceptanceTests: string;
  hintCount: number;
  status: StepStatus;
  /** Decisions you need to make before you can start this step. */
  blockedBy: { id: string; title: string }[];
  folder: string | null;
  attempt: StepAttemptView | null;
}

export interface StepSubmitResponse {
  results: ProjectCheckResult;
  allPassed: boolean;
  independence: Independence;
  attempt: StepAttemptView;
}
