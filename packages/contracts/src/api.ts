/**
 * Response shapes of the local HTTP API, shared by every client (web app, VS Code extension,
 * and later the AI chat). Plain interfaces: the server produces them, clients trust them.
 */
import type { Independence, JournalEntry, Rationale, SkillNode, SkillState, TestRunResult } from "./index.ts";

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
