/**
 * Typed client for the local server. One function per service action.
 * (In M4 the VS Code extension gets an equivalent client; in M5 the chat calls the same actions.)
 */
import type {
  AttemptResponse,
  AttemptSummary,
  ChallengePublic,
  ChallengeRow,
  DecisionView,
  ProjectCheckResult,
  ProjectSummary,
  ProjectView,
  StepAttemptView,
  StepSubmitResponse,
  StepView,
  JournalEntry,
  NewJournalEntry,
  SkillRow,
  SubmitResponse,
  TestRunResult,
  TodayResponse,
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

export type Today = TodayResponse;
export type Attempt = AttemptResponse;
export type SubmitResult = SubmitResponse;
export type { Metric, SkillRow, ChallengeRow } from "@1pe/contracts";

export const api = {
  today: () => call<Today>("GET", "/today"),
  skills: () => call<SkillRow[]>("GET", "/skills"),
  challenges: () => call<ChallengeRow[]>("GET", "/challenges"),
  challenge: (id: string) => call<ChallengePublic>("GET", `/challenges/${id}`),
  attempts: (challengeId: string) =>
    call<AttemptSummary[]>("GET", `/challenges/${challengeId}/attempts`),
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

  // Build by Learning
  projects: () => call<ProjectSummary[]>("GET", "/projects"),
  project: (id: string) => call<ProjectView>("GET", `/projects/${id}`),
  startProject: (id: string, folder?: string) => call<ProjectView>("POST", `/projects/${id}/start`, folder ? { folder } : {}),
  decision: (projectId: string, id: string) => call<DecisionView>("GET", `/projects/${projectId}/decisions/${id}`),
  decide: (projectId: string, id: string, body: { optionId: string; reason: string; weights: Record<string, number> }) =>
    call<DecisionView>("POST", `/projects/${projectId}/decisions/${id}`, body),
  step: (projectId: string, id: string) => call<StepView>("GET", `/projects/${projectId}/steps/${id}`),
  startStep: (projectId: string, id: string) => call<StepAttemptView>("POST", `/projects/${projectId}/steps/${id}/attempts`),
  stepHint: (attemptId: number) => call<StepAttemptView>("POST", `/step-attempts/${attemptId}/hints`),
  runChecks: (attemptId: number) => call<ProjectCheckResult>("POST", `/step-attempts/${attemptId}/run`),
  submitStep: (attemptId: number, body: { explanation: string; usedOutsideHelp: boolean }) =>
    call<StepSubmitResponse>("POST", `/step-attempts/${attemptId}/submit`, body),
  stepReference: (attemptId: number) => call<StepAttemptView>("POST", `/step-attempts/${attemptId}/reference`, { confirm: true }),
};
