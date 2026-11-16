/**
 * Typed client for the local server. One function per service action.
 * (In M4 the VS Code extension gets an equivalent client; in M5 the chat calls the same actions.)
 */
import type {
  ChallengePublic,
  JournalEntry,
  NewJournalEntry,
  Rationale,
  SkillNode,
  SkillState,
  TestRunResult,
  Independence,
} from "@1pe/contracts";

export class ApiError extends Error {}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

export interface Today {
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

export interface Attempt {
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

export interface SubmitResult {
  results: TestRunResult;
  allPassed: boolean;
  independence: Independence;
  attempt: Attempt;
}

export const api = {
  today: () => call<Today>("GET", "/today"),
  skills: () => call<SkillRow[]>("GET", "/skills"),
  challenges: () => call<ChallengeRow[]>("GET", "/challenges"),
  challenge: (id: string) => call<ChallengePublic>("GET", `/challenges/${id}`),
  attempts: (challengeId: string) =>
    call<{ id: number; status: string; independence: Independence | null; startedAt: string; endedAt: string | null }[]>(
      "GET",
      `/challenges/${challengeId}/attempts`,
    ),
  startAttempt: (challengeId: string) => call<Attempt>("POST", `/challenges/${challengeId}/attempts`),
  attempt: (id: number) => call<Attempt>("GET", `/attempts/${id}`),
  event: (id: number, kind: "timer_start" | "timer_pause" | "first_edit") =>
    call<Attempt>("POST", `/attempts/${id}/events`, { kind, provenance: kind === "first_edit" ? "observed" : "manual", payload: {} }),
  hint: (id: number) => call<Attempt>("POST", `/attempts/${id}/hints`),
  run: (id: number, code: string) => call<TestRunResult>("POST", `/attempts/${id}/run`, { code }),
  submit: (id: number, body: { code: string; explanation: string; usedOutsideHelp: boolean }) =>
    call<SubmitResult>("POST", `/attempts/${id}/submit`, body),
  solution: (id: number) => call<Attempt>("POST", `/attempts/${id}/solution`, { confirm: true }),
  journal: (q = "") => call<JournalEntry[]>("GET", `/journal?q=${encodeURIComponent(q)}`),
  journalEntry: (id: number) => call<JournalEntry>("GET", `/journal/${id}`),
  createJournal: (e: NewJournalEntry) => call<JournalEntry>("POST", "/journal", e),
  updateJournal: (id: number, e: NewJournalEntry) => call<JournalEntry>("PUT", `/journal/${id}`, e),
};
