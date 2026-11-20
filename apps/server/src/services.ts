/**
 * The action layer. Every capability of 1% Engineer is a function here.
 *
 *   Web UI ──HTTP──► routes.ts ──► services.ts ◄── (M5) AI chat tool calls
 *   VS Code ─HTTP──┘                    │
 *                                       ▼
 *                              core (pure rules) + db
 *
 * Rule: a service either succeeds and returns what actually happened, or throws a
 * ServiceError. The AI mentor will only ever report results that came back from here,
 * so it can't claim it "saved" something that wasn't saved.
 */
import {
  classifyIndependence,
  deriveEvidence,
  projectSkillState,
  selectNextActivity,
} from "@1pe/core";
import type {
  ChallengePublic,
  Evidence,
  JournalEntry,
  NewEvent,
  NewJournalEntry,
  Rationale,
  SkillState,
  SubmitRequest,
  TestRunResult,
} from "@1pe/contracts";
import type { Content, LoadedChallenge } from "./content.ts";
import { nowIso, type DB } from "./db.ts";
import { runTests } from "./runner.ts";

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Ctx {
  db: DB;
  content: Content;
  now?: () => Date;
  /** Where new Build by Learning projects go. Defaults to ~/Documents/1pe-projects. */
  projectsDir?: string;
}
const now = (ctx: Ctx) => (ctx.now ? ctx.now() : new Date());

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export function allEvidence(ctx: Ctx): Evidence[] {
  const rows = ctx.db.prepare("SELECT * FROM evidence ORDER BY created_at").all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    skillId: r.skill_id as string,
    level: r.level as number,
    polarity: r.polarity as 1 | -1,
    kind: r.kind as Evidence["kind"],
    context: (r.context as string | null) ?? null,
    refType: r.ref_type as string,
    refId: r.ref_id as string,
    createdAt: r.created_at as string,
  }));
}

export function skillStates(ctx: Ctx): Map<string, SkillState> {
  const bySkill = new Map<string, Evidence[]>();
  for (const e of allEvidence(ctx)) {
    const list = bySkill.get(e.skillId) ?? [];
    list.push(e);
    bySkill.set(e.skillId, list);
  }
  const states = new Map<string, SkillState>();
  for (const id of ctx.content.skills.keys()) {
    states.set(id, projectSkillState(id, bySkill.get(id) ?? [], now(ctx)));
  }
  return states;
}

export function listSkills(ctx: Ctx) {
  const states = skillStates(ctx);
  const evidence = allEvidence(ctx);
  return [...ctx.content.skills.values()].map((s) => ({
    ...s,
    state: states.get(s.id)!,
    evidenceCount: evidence.filter((e) => e.skillId === s.id).length,
    failures: evidence.filter((e) => e.skillId === s.id && e.polarity === -1).length,
  }));
}

/* ------------------------------------------------------------------ */
/* Challenges                                                          */
/* ------------------------------------------------------------------ */

function getChallenge(ctx: Ctx, id: string): LoadedChallenge {
  const ch = ctx.content.challenges.get(id);
  if (!ch) throw new ServiceError(404, `No challenge "${id}"`);
  return ch;
}

export function toPublic(ch: LoadedChallenge): ChallengePublic {
  const { hints, ...rest } = ch.meta;
  return { ...rest, hintCount: hints.length, starterCode: ch.starter, publicTests: ch.publicTests };
}

/**
 * Challenges in learning order: easiest first, then the suggested `sequence` within a difficulty,
 * then id. The selector still decides; this just means ties and the placeholder favour beginner work.
 */
function inLearningOrder(ctx: Ctx): LoadedChallenge[] {
  return [...ctx.content.challenges.values()].sort(
    (a, b) =>
      a.meta.difficulty - b.meta.difficulty ||
      (a.meta.sequence ?? 999) - (b.meta.sequence ?? 999) ||
      a.meta.id.localeCompare(b.meta.id),
  );
}

function passedIds(ctx: Ctx): Set<string> {
  const rows = ctx.db.prepare("SELECT DISTINCT challenge_id FROM attempts WHERE status = 'passed'").all() as {
    challenge_id: string;
  }[];
  return new Set(rows.map((r) => r.challenge_id));
}

export function listChallenges(ctx: Ctx) {
  const passed = passedIds(ctx);
  return inLearningOrder(ctx).map((c) => ({
    id: c.meta.id,
    title: c.meta.title,
    type: c.meta.type,
    difficulty: c.meta.difficulty,
    skills: c.meta.skills,
    passed: passed.has(c.meta.id),
  }));
}

export function getChallengePublic(ctx: Ctx, id: string) {
  return toPublic(getChallenge(ctx, id));
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

export function today(ctx: Ctx) {
  const date = dateKey(now(ctx));
  const passed = passedIds(ctx);
  const states = skillStates(ctx);

  let plan = ctx.db.prepare("SELECT * FROM daily_plans WHERE date = ?").get(date) as
    | { challenge_id: string; rationale: string }
    | undefined;

  // No daily limit: once today's challenge is passed, today moves on to the next one.
  if (!plan || passed.has(plan.challenge_id)) {
    const selection = selectNextActivity({
      candidates: inLearningOrder(ctx).map((c) => ({
        id: c.meta.id,
        title: c.meta.title,
        skills: c.meta.skills,
        targetLevel: c.meta.targetLevel,
        difficulty: c.meta.difficulty,
      })),
      graph: ctx.content.skills,
      states,
      passedIds: passed,
    });
    if (selection) {
      ctx.db
        .prepare(
          `INSERT INTO daily_plans (date, challenge_id, rationale) VALUES (?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET challenge_id = excluded.challenge_id, rationale = excluded.rationale`,
        )
        .run(date, selection.activityId, JSON.stringify(selection.rationale));
      plan = { challenge_id: selection.activityId, rationale: JSON.stringify(selection.rationale) };
    }
  }

  const challenge = plan ? ctx.content.challenges.get(plan.challenge_id) : undefined;
  const passedToday = (
    ctx.db
      .prepare("SELECT challenge_id, MIN(ended_at) AS at FROM attempts WHERE status = 'passed' AND ended_at >= ? GROUP BY challenge_id ORDER BY at")
      .all(date) as { challenge_id: string }[]
  ).map((r) => ({ id: r.challenge_id, title: ctx.content.challenges.get(r.challenge_id)?.meta.title ?? r.challenge_id }));
  const openAttempt = challenge
    ? (ctx.db
        .prepare("SELECT id FROM attempts WHERE challenge_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1")
        .get(challenge.meta.id) as { id: number } | undefined)
    : undefined;

  const weekAgo = new Date(now(ctx).getTime() - 7 * 86_400_000).toISOString();
  const practicedDays = (
    ctx.db.prepare("SELECT COUNT(DISTINCT substr(ts, 1, 10)) AS n FROM attempt_events WHERE ts >= ?").get(weekAgo) as {
      n: number;
    }
  ).n;

  const twoWeeksAgo = new Date(now(ctx).getTime() - 14 * 86_400_000).toISOString();
  const weaknesses = ctx.db
    .prepare(
      `SELECT skill_id, COUNT(*) AS failures, MAX(created_at) AS last FROM evidence
       WHERE polarity = -1 AND created_at >= ? GROUP BY skill_id ORDER BY failures DESC LIMIT 5`,
    )
    .all(twoWeeksAgo) as { skill_id: string; failures: number; last: string }[];

  const reviews = [...states.values()]
    .filter((s) => s.nextReviewAt)
    .sort((a, b) => a.nextReviewAt!.localeCompare(b.nextReviewAt!))
    .slice(0, 3);

  return {
    date,
    primary: challenge
      ? {
          challenge: {
            id: challenge.meta.id,
            title: challenge.meta.title,
            objective: challenge.meta.objective,
            type: challenge.meta.type,
            difficulty: challenge.meta.difficulty,
            skills: challenge.meta.skills,
            phase: Math.min(...challenge.meta.skills.map((s) => ctx.content.skills.get(s)?.phase ?? 1)),
          },
          rationale: JSON.parse(plan!.rationale) as Rationale,
          passed: passed.has(challenge.meta.id),
          openAttemptId: openAttempt?.id ?? null,
        }
      : null,
    stats: {
      challengesPassed: passed.size,
      challengesTotal: ctx.content.challenges.size,
      passedToday,
      practicedDaysThisWeek: practicedDays,
      projectionImplemented: [...states.values()].every((s) => s.implemented),
    },
    weaknesses: weaknesses.map((w) => ({
      skillId: w.skill_id,
      name: ctx.content.skills.get(w.skill_id)?.name ?? w.skill_id,
      failures: w.failures,
      last: w.last,
    })),
    reviews: reviews.map((s) => ({ skillId: s.skillId, nextReviewAt: s.nextReviewAt })),
    recentJournal: listJournal(ctx, "").slice(0, 3),
  };
}

/* ------------------------------------------------------------------ */
/* Attempts                                                            */
/* ------------------------------------------------------------------ */

interface AttemptRow {
  id: number;
  challenge_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  independence: string | null;
}

function getAttemptRow(ctx: Ctx, id: number): AttemptRow {
  const row = ctx.db.prepare("SELECT * FROM attempts WHERE id = ?").get(id) as AttemptRow | undefined;
  if (!row) throw new ServiceError(404, `No attempt ${id}`);
  return row;
}

function requireOpen(row: AttemptRow) {
  if (row.status !== "in_progress") throw new ServiceError(409, `Attempt ${row.id} is already ${row.status}`);
}

function addEvent(ctx: Ctx, attemptId: number, e: NewEvent) {
  ctx.db
    .prepare("INSERT INTO attempt_events (attempt_id, ts, kind, provenance, payload) VALUES (?, ?, ?, ?, ?)")
    .run(attemptId, now(ctx).toISOString(), e.kind, e.provenance, JSON.stringify(e.payload ?? {}));
}

function events(ctx: Ctx, attemptId: number) {
  return (
    ctx.db.prepare("SELECT * FROM attempt_events WHERE attempt_id = ? ORDER BY ts, id").all(attemptId) as {
      ts: string;
      kind: string;
      provenance: string;
      payload: string;
    }[]
  ).map((e) => ({ ...e, payload: JSON.parse(e.payload) as Record<string, unknown> }));
}

export function listAttempts(ctx: Ctx, challengeId: string) {
  getChallenge(ctx, challengeId);
  return ctx.db
    .prepare("SELECT id, status, independence, started_at AS startedAt, ended_at AS endedAt FROM attempts WHERE challenge_id = ? ORDER BY id DESC")
    .all(challengeId) as { id: number; status: string; independence: string | null; startedAt: string; endedAt: string | null }[];
}

/** Resumes the open attempt for this challenge, or starts a new one. */
export function startAttempt(ctx: Ctx, challengeId: string) {
  getChallenge(ctx, challengeId);
  const open = ctx.db
    .prepare("SELECT id FROM attempts WHERE challenge_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1")
    .get(challengeId) as { id: number } | undefined;
  if (open) return getAttempt(ctx, open.id);

  const res = ctx.db
    .prepare("INSERT INTO attempts (challenge_id, started_at) VALUES (?, ?)")
    .run(challengeId, now(ctx).toISOString());
  const id = Number(res.lastInsertRowid);
  addEvent(ctx, id, { kind: "attempt_started", provenance: "observed", payload: {} });
  return getAttempt(ctx, id);
}

export function getAttempt(ctx: Ctx, id: number) {
  const row = getAttemptRow(ctx, id);
  const ch = getChallenge(ctx, row.challenge_id);
  const evs = events(ctx, id);
  const hintsRevealed = evs.filter((e) => e.kind === "hint_requested").length;
  const lastSubmission = ctx.db
    .prepare("SELECT code, explanation, test_results, created_at FROM submissions WHERE attempt_id = ? ORDER BY id DESC LIMIT 1")
    .get(id) as { code: string; explanation: string; test_results: string; created_at: string } | undefined;

  return {
    id: row.id,
    challengeId: row.challenge_id,
    status: row.status,
    independence: row.independence,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    hints: ch.meta.hints.slice(0, hintsRevealed),
    hintCount: ch.meta.hints.length,
    solution: evs.some((e) => e.kind === "solution_viewed") ? ch.solution : null,
    lastSubmission: lastSubmission
      ? {
          code: lastSubmission.code,
          explanation: lastSubmission.explanation,
          results: JSON.parse(lastSubmission.test_results) as TestRunResult,
          createdAt: lastSubmission.created_at,
        }
      : null,
    metrics: attemptMetrics(row, evs, now(ctx)),
  };
}

/**
 * Every metric declares its provenance. Be honest about what each one can't tell you.
 */
function attemptMetrics(row: AttemptRow, evs: ReturnType<typeof events>, at: Date) {
  const start = new Date(row.started_at).getTime();
  const end = row.ended_at ? new Date(row.ended_at).getTime() : at.getTime();
  const firstEdit = evs.find((e) => e.kind === "first_edit");

  let thinkingMs = 0;
  let timerStartedAt: number | null = null;
  for (const e of evs) {
    if (e.kind === "timer_start" && timerStartedAt === null) timerStartedAt = new Date(e.ts).getTime();
    if (e.kind === "timer_pause" && timerStartedAt !== null) {
      thinkingMs += new Date(e.ts).getTime() - timerStartedAt;
      timerStartedAt = null;
    }
  }
  // valueMs = completed intervals only; clients add (now − runningSince) for a live display.
  const timerRunningSince = timerStartedAt ? new Date(timerStartedAt).toISOString() : null;

  return [
    {
      key: "elapsed",
      label: "Elapsed since start",
      valueMs: end - start,
      provenance: "observed" as const,
      caveat: "Wall-clock time. Includes breaks. Not active work time.",
    },
    {
      key: "timeToFirstEdit",
      label: "Time before first code edit",
      valueMs: firstEdit ? new Date(firstEdit.ts).getTime() - start : null,
      provenance: "observed" as const,
      caveat: "Long isn't bad: it may be planning. Short may mean you rushed.",
    },
    {
      key: "thinking",
      label: "Thinking time (your timer)",
      valueMs: thinkingMs,
      provenance: "manual" as const,
      caveat: "Only as accurate as your timer use.",
      runningSince: timerRunningSince,
    },
    {
      key: "testRuns",
      label: "Test runs",
      count: evs.filter((e) => e.kind === "test_run").length,
      provenance: "observed" as const,
      caveat: "Many runs may mean trial-and-error rather than reasoning.",
    },
    {
      key: "hints",
      label: "Hints used",
      count: evs.filter((e) => e.kind === "hint_requested").length,
      provenance: "observed" as const,
      caveat: "Doesn't see help from outside 1% Engineer. That's self-reported.",
    },
  ];
}

export function recordEvent(ctx: Ctx, attemptId: number, e: NewEvent) {
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  const allowed = new Set(["timer_start", "timer_pause", "first_edit"]);
  if (!allowed.has(e.kind)) throw new ServiceError(400, `Clients can't record "${e.kind}" events directly`);
  if (e.kind === "first_edit" && events(ctx, attemptId).some((x) => x.kind === "first_edit")) {
    return getAttempt(ctx, attemptId); // idempotent
  }
  addEvent(ctx, attemptId, e);
  return getAttempt(ctx, attemptId);
}

export function requestHint(ctx: Ctx, attemptId: number) {
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  const ch = getChallenge(ctx, row.challenge_id);
  const used = events(ctx, attemptId).filter((e) => e.kind === "hint_requested").length;
  if (used >= ch.meta.hints.length) throw new ServiceError(409, "No more hints. Ask for the solution explicitly if you need it.");
  addEvent(ctx, attemptId, { kind: "hint_requested", provenance: "observed", payload: { index: used } });
  return getAttempt(ctx, attemptId);
}

export async function runPublicTests(ctx: Ctx, attemptId: number, code: string) {
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  const ch = getChallenge(ctx, row.challenge_id);
  const result = await runTests(code, { publicTests: ch.publicTests });
  addEvent(ctx, attemptId, {
    kind: "test_run",
    provenance: "observed",
    payload: { passed: result.passed, failed: result.failed },
  });
  return result;
}

export function revealSolution(ctx: Ctx, attemptId: number, confirm: boolean) {
  if (!confirm) throw new ServiceError(400, "Viewing the solution needs explicit confirmation.");
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  if (!events(ctx, attemptId).some((e) => e.kind === "solution_viewed")) {
    addEvent(ctx, attemptId, { kind: "solution_viewed", provenance: "observed", payload: {} });
  }
  return getAttempt(ctx, attemptId);
}

export async function submit(ctx: Ctx, attemptId: number, req: SubmitRequest) {
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  const ch = getChallenge(ctx, row.challenge_id);
  const results = await runTests(req.code, { publicTests: ch.publicTests, hiddenTests: ch.hiddenTests });
  const allPassed = results.failed === 0 && results.passed > 0;

  const evs = events(ctx, attemptId);
  const hintEvents = evs.filter((e) => e.kind === "hint_requested");
  const independence = classifyIndependence({
    maxHintIndex: hintEvents.length ? Math.max(...hintEvents.map((e) => Number(e.payload.index ?? 0))) : null,
    totalHints: hintEvents.length,
    solutionViewed: evs.some((e) => e.kind === "solution_viewed"),
    usedOutsideHelp: req.usedOutsideHelp,
  });

  const ts = now(ctx).toISOString();
  ctx.db.exec("BEGIN");
  try {
    ctx.db
      .prepare(
        "INSERT INTO submissions (attempt_id, created_at, code, explanation, used_outside_help, test_results) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(attemptId, ts, req.code, req.explanation, req.usedOutsideHelp ? 1 : 0, JSON.stringify(results));
    addEvent(ctx, attemptId, {
      kind: "submission",
      provenance: "observed",
      payload: { passed: results.passed, failed: results.failed },
    });

    // A failed submission keeps the attempt open: you can keep working.
    // A passing one closes it and records independence.
    if (allPassed) {
      ctx.db
        .prepare("UPDATE attempts SET status = 'passed', ended_at = ?, independence = ? WHERE id = ?")
        .run(ts, independence, attemptId);
    }

    const insert = ctx.db.prepare(
      "INSERT INTO evidence (skill_id, level, polarity, kind, context, ref_type, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const e of deriveEvidence({
      skills: ch.meta.skills,
      targetLevel: ch.meta.targetLevel,
      allTestsPassed: allPassed,
      independence,
      context: ch.context,
      attemptId,
    })) {
      insert.run(e.skillId, e.level, e.polarity, e.kind, e.context, e.refType, e.refId, ts);
    }
    ctx.db.exec("COMMIT");
  } catch (err) {
    ctx.db.exec("ROLLBACK");
    throw err;
  }

  return { results, allPassed, independence, attempt: getAttempt(ctx, attemptId) };
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

function journalBody(e: NewJournalEntry) {
  return [...Object.values(e.fields), ...e.tags].join("\n");
}

function rowToEntry(r: Record<string, unknown>): JournalEntry {
  return {
    id: r.id as number,
    title: r.title as string,
    attemptId: (r.attempt_id as number | null) ?? null,
    fields: JSON.parse(r.fields as string),
    tags: JSON.parse(r.tags as string),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function listJournal(ctx: Ctx, q: string): JournalEntry[] {
  const query = q.trim();
  if (!query) {
    return (ctx.db.prepare("SELECT * FROM journal_entries ORDER BY created_at DESC").all() as Record<string, unknown>[]).map(
      rowToEntry,
    );
  }
  // Quote each term so user input can't break FTS syntax; prefix-match the last one.
  const terms = query.split(/\s+/).map((t) => `"${t.replace(/"/g, '""')}"`);
  terms[terms.length - 1] += "*";
  const rows = ctx.db
    .prepare(
      `SELECT j.* FROM journal_fts f JOIN journal_entries j ON j.id = f.rowid
       WHERE journal_fts MATCH ? ORDER BY rank`,
    )
    .all(terms.join(" ")) as Record<string, unknown>[];
  return rows.map(rowToEntry);
}

export function getJournal(ctx: Ctx, id: number) {
  const r = ctx.db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!r) throw new ServiceError(404, `No journal entry ${id}`);
  return rowToEntry(r);
}

export function createJournal(ctx: Ctx, e: NewJournalEntry) {
  if (e.attemptId !== null) getAttemptRow(ctx, e.attemptId);
  const ts = nowIso();
  ctx.db.exec("BEGIN");
  try {
    const res = ctx.db
      .prepare(
        "INSERT INTO journal_entries (title, attempt_id, fields, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(e.title, e.attemptId, JSON.stringify(e.fields), JSON.stringify(e.tags), ts, ts);
    const id = Number(res.lastInsertRowid);
    ctx.db.prepare("INSERT INTO journal_fts (rowid, title, body) VALUES (?, ?, ?)").run(id, e.title, journalBody(e));
    ctx.db.exec("COMMIT");
    return getJournal(ctx, id);
  } catch (err) {
    ctx.db.exec("ROLLBACK");
    throw err;
  }
}

export function updateJournal(ctx: Ctx, id: number, e: NewJournalEntry) {
  getJournal(ctx, id);
  ctx.db.exec("BEGIN");
  try {
    ctx.db
      .prepare("UPDATE journal_entries SET title = ?, fields = ?, tags = ?, updated_at = ? WHERE id = ?")
      .run(e.title, JSON.stringify(e.fields), JSON.stringify(e.tags), nowIso(), id);
    ctx.db.prepare("DELETE FROM journal_fts WHERE rowid = ?").run(id);
    ctx.db.prepare("INSERT INTO journal_fts (rowid, title, body) VALUES (?, ?, ?)").run(id, e.title, journalBody(e));
    ctx.db.exec("COMMIT");
    return getJournal(ctx, id);
  } catch (err) {
    ctx.db.exec("ROLLBACK");
    throw err;
  }
}
