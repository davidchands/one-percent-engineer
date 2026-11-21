/**
 * Build by Learning services (docs/BUILD-BY-LEARNING.md): start a project, make decisions,
 * and work through steps whose checks run against your own project folder.
 *
 * Same rules as services.ts: a function either succeeds and returns what actually happened,
 * or throws a ServiceError.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { classifyIndependence } from "@1pe/core";
import type {
  DecideRequest,
  DecisionChoice,
  DecisionView,
  Independence,
  ProjectCheckResult,
  ProjectSummary,
  ProjectView,
  RoadmapItem,
  StepAttemptView,
  StepStatus,
  StepSubmitRequest,
  StepSubmitResponse,
  StepView,
} from "@1pe/contracts";
import type { LoadedProject, LoadedStep } from "./content.ts";
import { runProjectChecks } from "./project-runner.ts";
import { ServiceError, type Ctx } from "./services.ts";

const now = (ctx: Ctx) => (ctx.now ? ctx.now() : new Date());
const projectsDir = (ctx: Ctx) => ctx.projectsDir ?? join(homedir(), "Documents", "1pe-projects");

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

interface ProjectRow {
  id: number;
  project_id: string;
  folder: string;
  started_at: string;
}

interface StepAttemptRow {
  id: number;
  project_row: number;
  step_id: string;
  options_key: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  independence: string | null;
}

function getProject(ctx: Ctx, id: string): LoadedProject {
  const p = ctx.content.projects.get(id);
  if (!p) throw new ServiceError(404, `No project "${id}"`);
  return p;
}

function getStep(project: LoadedProject, stepId: string): LoadedStep {
  const s = project.steps.get(stepId);
  if (!s) throw new ServiceError(404, `No step "${stepId}" in ${project.meta.id}`);
  return s;
}

function projectRow(ctx: Ctx, id: string): ProjectRow | undefined {
  return ctx.db.prepare("SELECT * FROM projects WHERE project_id = ?").get(id) as ProjectRow | undefined;
}

function requireStarted(ctx: Ctx, id: string): ProjectRow {
  const row = projectRow(ctx, id);
  if (!row) throw new ServiceError(409, "Start the project first.");
  return row;
}

/** Every decision you've made for a project, oldest first. */
function decisionRows(ctx: Ctx, row: ProjectRow | undefined) {
  if (!row) return [];
  return (
    ctx.db.prepare("SELECT * FROM project_decisions WHERE project_row = ? ORDER BY id").all(row.id) as {
      decision_id: string;
      option_id: string;
      reason: string;
      weights: string;
      decided_at: string;
    }[]
  ).map((r) => ({
    decisionId: r.decision_id,
    choice: { optionId: r.option_id, reason: r.reason, weights: JSON.parse(r.weights), decidedAt: r.decided_at } as DecisionChoice,
  }));
}

/** Your current choice per decision: the latest row wins. */
function currentChoices(ctx: Ctx, row: ProjectRow | undefined): Map<string, DecisionChoice> {
  const m = new Map<string, DecisionChoice>();
  for (const r of decisionRows(ctx, row)) m.set(r.decisionId, r.choice);
  return m;
}

/** The reference key for a step under your current choices, or null if a decision is still to make. */
function optionsKey(step: LoadedStep, choices: Map<string, DecisionChoice>): string | null {
  if (step.meta.dependsOn.length === 0) return "default";
  const picked = step.meta.dependsOn.map((d) => choices.get(d)?.optionId);
  return picked.every(Boolean) ? picked.join("+") : null;
}

function stepAttempts(ctx: Ctx, row: ProjectRow, stepId: string): StepAttemptRow[] {
  return ctx.db
    .prepare("SELECT * FROM step_attempts WHERE project_row = ? AND step_id = ? ORDER BY id DESC")
    .all(row.id, stepId) as unknown as StepAttemptRow[];
}

function stepStatus(ctx: Ctx, project: LoadedProject, row: ProjectRow | undefined, step: LoadedStep, choices: Map<string, DecisionChoice>) {
  const blockedBy = step.meta.dependsOn.filter((d) => !choices.has(d));
  if (!row || blockedBy.length) return { status: "blocked" as StepStatus, blockedBy };
  const key = optionsKey(step, choices)!;
  const attempts = stepAttempts(ctx, row, step.meta.id);
  let status: StepStatus = "ready";
  if (attempts.some((a) => a.status === "passed" && a.options_key === key)) status = "passed";
  else if (attempts.some((a) => a.status === "in_progress" && a.options_key === key)) status = "in_progress";
  else if (attempts.some((a) => a.status === "passed")) status = "redo"; // passed, but with a choice you've since changed
  return { status, blockedBy };
}

/** Skills you've shown at least once in a challenge (any positive evidence). */
function practisedSkills(ctx: Ctx): Set<string> {
  const rows = ctx.db.prepare("SELECT DISTINCT skill_id FROM evidence WHERE polarity = 1").all() as { skill_id: string }[];
  return new Set(rows.map((r) => r.skill_id));
}

const skillName = (ctx: Ctx, id: string) => ctx.content.skills.get(id)?.name ?? id;

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export function listProjects(ctx: Ctx): ProjectSummary[] {
  return [...ctx.content.projects.values()].map((p) => {
    const row = projectRow(ctx, p.meta.id);
    const choices = currentChoices(ctx, row);
    const steps = [...p.steps.values()];
    return {
      id: p.meta.id,
      title: p.meta.title,
      brief: p.meta.brief,
      started: Boolean(row),
      folder: row?.folder ?? null,
      progress: {
        stepsPassed: steps.filter((s) => stepStatus(ctx, p, row, s, choices).status === "passed").length,
        steps: steps.length,
        decisionsMade: [...p.decisions.keys()].filter((d) => choices.has(d)).length,
        decisions: p.decisions.size,
      },
    };
  });
}

export function getProjectView(ctx: Ctx, id: string): ProjectView {
  const p = getProject(ctx, id);
  const row = projectRow(ctx, id);
  const choices = currentChoices(ctx, row);
  const practised = practisedSkills(ctx);
  let next: ProjectView["next"] = null;

  const milestones = p.meta.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    goal: m.goal,
    items: m.items.map((item): RoadmapItem => {
      if ("decision" in item) {
        const d = p.decisions.get(item.decision)!;
        const c = choices.get(d.id);
        if (!c && !next) next = { kind: "decision", id: d.id };
        return {
          kind: "decision",
          id: d.id,
          title: d.title,
          chosen: c ? { optionId: c.optionId, name: d.options.find((o) => o.id === c.optionId)?.name ?? c.optionId } : null,
        };
      }
      if ("step" in item) {
        const s = getStep(p, item.step);
        const st = stepStatus(ctx, p, row, s, choices);
        if (st.status !== "passed" && !next) next = { kind: "step", id: s.meta.id };
        return { kind: "step", id: s.meta.id, title: s.meta.title, ...st };
      }
      return { kind: "checkpoint", prompt: item.checkpoint };
    }),
  }));

  return {
    id,
    title: p.meta.title,
    brief: p.meta.brief,
    whatYouBuild: p.meta.whatYouBuild,
    started: Boolean(row),
    folder: row?.folder ?? null,
    suggestedFolder: join(projectsDir(ctx), id),
    prerequisites: p.meta.prerequisites.map((s) => ({ id: s, name: skillName(ctx, s), practised: practised.has(s) })),
    milestones,
    next: row ? next : null,
  };
}

/** Creates your project folder (with a README of the brief) and starts tracking it. */
export function startProject(ctx: Ctx, id: string, folder?: string): ProjectView {
  const p = getProject(ctx, id);
  if (projectRow(ctx, id)) return getProjectView(ctx, id);
  const dir = folder ?? join(projectsDir(ctx), id);
  if (!isAbsolute(dir)) throw new ServiceError(400, "The project folder must be an absolute path.");
  if (existsSync(dir) && !statSync(dir).isDirectory()) throw new ServiceError(409, `${dir} exists and isn't a folder.`);
  mkdirSync(dir, { recursive: true });
  const readme = join(dir, "README.md");
  if (!existsSync(readme)) {
    writeFileSync(
      readme,
      `# ${p.meta.title}\n\n${p.meta.brief.trim()}\n\n## What I'm building\n\n${p.meta.whatYouBuild.map((w) => `- ${w}`).join("\n")}\n\n` +
        `Built step by step with 1% Engineer's Build by Learning. My technology choices, and why, are in \`docs/decisions/\`.\n`,
    );
  }
  ctx.db.prepare("INSERT INTO projects (project_id, folder, started_at) VALUES (?, ?, ?)").run(id, dir, now(ctx).toISOString());
  return getProjectView(ctx, id);
}

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

function decisionNumber(p: LoadedProject, decisionId: string) {
  return p.order.filter((o) => o.kind === "decision").findIndex((o) => o.kind === "decision" && o.id === decisionId) + 1;
}

const recordFile = (number: number, decisionId: string) => join("docs", "decisions", `${String(number).padStart(4, "0")}-${decisionId}.md`);

export function getDecisionView(ctx: Ctx, projectId: string, decisionId: string): DecisionView {
  const p = getProject(ctx, projectId);
  const d = p.decisions.get(decisionId);
  if (!d) throw new ServiceError(404, `No decision "${decisionId}" in ${projectId}`);
  const row = projectRow(ctx, projectId);
  const history = decisionRows(ctx, row).filter((r) => r.decisionId === decisionId).map((r) => r.choice);
  const choices = currentChoices(ctx, row);
  const practised = practisedSkills(ctx);
  const number = decisionNumber(p, decisionId);

  return {
    projectId,
    number,
    decision: d,
    chosen: history.at(-1) ?? null,
    history,
    readiness: Object.fromEntries(
      d.options.map((o) => [
        o.id,
        {
          practised: o.relatedSkills.filter((s) => practised.has(s)).map((s) => skillName(ctx, s)),
          notYet: o.relatedSkills.filter((s) => !practised.has(s)).map((s) => skillName(ctx, s)),
        },
      ]),
    ),
    affectedSteps: [...p.steps.values()]
      .filter((s) => s.meta.dependsOn.includes(decisionId))
      .map((s) => ({ id: s.meta.id, title: s.meta.title, passed: stepStatus(ctx, p, row, s, choices).status === "passed" })),
    recordPath: row && history.length ? join(row.folder, recordFile(number, decisionId)) : null,
  };
}

/** Records your choice (append-only) and writes the decision record into your project. */
export function decide(ctx: Ctx, projectId: string, decisionId: string, req: DecideRequest): DecisionView {
  const p = getProject(ctx, projectId);
  const d = p.decisions.get(decisionId);
  if (!d) throw new ServiceError(404, `No decision "${decisionId}" in ${projectId}`);
  const row = requireStarted(ctx, projectId);
  const option = d.options.find((o) => o.id === req.optionId);
  if (!option) throw new ServiceError(400, `"${req.optionId}" isn't one of the options.`);
  const criteria = new Set(d.criteria.map((c) => c.id));
  for (const k of Object.keys(req.weights)) if (!criteria.has(k)) throw new ServiceError(400, `Unknown criterion "${k}".`);

  ctx.db
    .prepare("INSERT INTO project_decisions (project_row, decision_id, option_id, reason, weights, decided_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, decisionId, option.id, req.reason.trim(), JSON.stringify(req.weights), now(ctx).toISOString());

  const view = getDecisionView(ctx, projectId, decisionId);
  const file = join(row.folder, recordFile(view.number, decisionId));
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, decisionRecord(view));
  return view;
}

const WEIGHT_WORDS = ["doesn't matter", "matters a little", "matters", "matters a lot"];

/** A short architecture decision record (ADR), in the format many teams use. */
function decisionRecord(v: DecisionView): string {
  const d = v.decision;
  const name = (id: string) => d.options.find((o) => o.id === id)?.name ?? id;
  const c = v.chosen!;
  const chosen = d.options.find((o) => o.id === c.optionId)!;
  const lines = [
    `# ${String(v.number).padStart(4, "0")}. ${d.title}`,
    "",
    `Date: ${c.decidedAt.slice(0, 10)}  `,
    `Status: decided${v.history.length > 1 ? " (changed)" : ""}`,
    "",
    "## Context",
    "",
    d.problem.trim(),
    "",
    "## Options considered",
    "",
    ...d.options.map((o) => `- **${o.name}**: ${o.summary.trim()}`),
    "",
    "## Decision",
    "",
    `**${chosen.name}.** ${c.reason}`,
    "",
  ];
  const weights = d.criteria.filter((cr) => c.weights[cr.id] !== undefined);
  if (weights.length) {
    lines.push("## What mattered", "", ...weights.map((cr) => `- ${cr.label}: ${WEIGHT_WORDS[c.weights[cr.id]!]}`), "");
  }
  lines.push(
    "## Consequences",
    "",
    ...chosen.strengths.map((s) => `- Good: ${s}`),
    ...chosen.costs.map((s) => `- Cost: ${s}`),
    `- Changing later: ${d.costOfChangingLater.trim()}`,
    "",
  );
  if (v.history.length > 1) {
    lines.push("## History", "", ...v.history.map((h) => `- ${h.decidedAt.slice(0, 10)}: ${name(h.optionId)}. ${h.reason}`), "");
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

/** The hints for your chosen option if the step has them, else the step's general hints. */
function hintsFor(step: LoadedStep, choices: Map<string, DecisionChoice>): string[] {
  for (const d of step.meta.dependsOn) {
    const v = step.meta.variants[choices.get(d)?.optionId ?? ""];
    if (v?.hints) return v.hints;
  }
  return step.meta.hints;
}

export function getStepView(ctx: Ctx, projectId: string, stepId: string): StepView {
  const p = getProject(ctx, projectId);
  const step = getStep(p, stepId);
  const row = projectRow(ctx, projectId);
  const choices = currentChoices(ctx, row);
  const st = stepStatus(ctx, p, row, step, choices);
  const key = optionsKey(step, choices);
  const attempts = row && key ? stepAttempts(ctx, row, stepId).filter((a) => a.options_key === key) : [];
  const current = attempts.find((a) => a.status === "in_progress") ?? attempts[0];

  return {
    projectId,
    id: stepId,
    title: step.meta.title,
    objective: step.meta.objective,
    lesson: step.meta.lesson ?? null,
    task: step.meta.task,
    requirements: step.meta.requirements,
    notes: step.meta.dependsOn.flatMap((dId) => {
      const optionId = choices.get(dId)?.optionId;
      const v = optionId ? step.meta.variants[optionId] : undefined;
      if (!v) return [];
      const d = p.decisions.get(dId)!;
      return [{ decisionTitle: d.title, optionName: d.options.find((o) => o.id === optionId)!.name, notes: v.notes, example: v.example ?? null }];
    }),
    commonMistakes: step.meta.commonMistakes,
    explanationCheckpoint: step.meta.explanationCheckpoint,
    startsApp: step.meta.startsApp,
    acceptanceTests: step.acceptanceTests,
    hintCount: hintsFor(step, choices).length,
    status: st.status,
    blockedBy: st.blockedBy.map((id) => ({ id, title: p.decisions.get(id)!.title })),
    folder: row?.folder ?? null,
    attempt: current ? stepAttemptView(ctx, current.id) : null,
  };
}

function getAttemptRow(ctx: Ctx, id: number): StepAttemptRow {
  const row = ctx.db.prepare("SELECT * FROM step_attempts WHERE id = ?").get(id) as StepAttemptRow | undefined;
  if (!row) throw new ServiceError(404, `No step attempt ${id}`);
  return row;
}

function requireOpen(row: StepAttemptRow) {
  if (row.status !== "in_progress") throw new ServiceError(409, `Step attempt ${row.id} is already ${row.status}`);
}

function attemptContext(ctx: Ctx, row: StepAttemptRow) {
  const pRow = ctx.db.prepare("SELECT * FROM projects WHERE id = ?").get(row.project_row) as unknown as ProjectRow;
  const project = getProject(ctx, pRow.project_id);
  return { pRow, project, step: getStep(project, row.step_id), choices: currentChoices(ctx, pRow) };
}

function addEvent(ctx: Ctx, attemptId: number, kind: string, payload: Record<string, unknown> = {}) {
  ctx.db
    .prepare("INSERT INTO step_events (attempt_id, ts, kind, payload) VALUES (?, ?, ?, ?)")
    .run(attemptId, now(ctx).toISOString(), kind, JSON.stringify(payload));
}

function eventsOf(ctx: Ctx, attemptId: number) {
  return (ctx.db.prepare("SELECT kind, payload FROM step_events WHERE attempt_id = ? ORDER BY ts, id").all(attemptId) as {
    kind: string;
    payload: string;
  }[]).map((e) => ({ kind: e.kind, payload: JSON.parse(e.payload) as Record<string, unknown> }));
}

export function stepAttemptView(ctx: Ctx, id: number): StepAttemptView {
  const row = getAttemptRow(ctx, id);
  const { step, choices } = attemptContext(ctx, row);
  const evs = eventsOf(ctx, id);
  const hints = hintsFor(step, choices);
  const lastRun = [...evs].reverse().find((e) => e.kind === "check_run");
  const sub = ctx.db
    .prepare("SELECT explanation, results, created_at FROM step_submissions WHERE attempt_id = ? ORDER BY id DESC LIMIT 1")
    .get(id) as { explanation: string; results: string; created_at: string } | undefined;
  const viewed = evs.some((e) => e.kind === "solution_viewed");
  return {
    id,
    stepId: row.step_id,
    status: row.status,
    independence: (row.independence as Independence | null) ?? null,
    optionsKey: row.options_key,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    hints: hints.slice(0, evs.filter((e) => e.kind === "hint_requested").length),
    hintCount: hints.length,
    checkRuns: evs.filter((e) => e.kind === "check_run").length,
    lastCheck: (lastRun?.payload.result as ProjectCheckResult | undefined) ?? null,
    lastSubmission: sub ? { explanation: sub.explanation, results: JSON.parse(sub.results), createdAt: sub.created_at } : null,
    reference: viewed ? referenceFiles(step, row.options_key) : null,
  };
}

/** Resumes your open attempt for this step, or starts one. Needs the step's decisions made. */
export function startStepAttempt(ctx: Ctx, projectId: string, stepId: string): StepAttemptView {
  const p = getProject(ctx, projectId);
  const step = getStep(p, stepId);
  const row = requireStarted(ctx, projectId);
  const choices = currentChoices(ctx, row);
  const key = optionsKey(step, choices);
  if (!key) {
    const missing = step.meta.dependsOn.filter((d) => !choices.has(d)).map((d) => p.decisions.get(d)!.title);
    throw new ServiceError(409, `Make this decision first: ${missing.join(", ")}`);
  }
  for (const a of stepAttempts(ctx, row, stepId)) {
    if (a.status !== "in_progress") continue;
    if (a.options_key === key) return stepAttemptView(ctx, a.id);
    // You changed your mind since starting this one: it was for a different stack.
    ctx.db.prepare("UPDATE step_attempts SET status = 'abandoned', ended_at = ? WHERE id = ?").run(now(ctx).toISOString(), a.id);
  }
  const res = ctx.db
    .prepare("INSERT INTO step_attempts (project_row, step_id, options_key, started_at) VALUES (?, ?, ?, ?)")
    .run(row.id, stepId, key, now(ctx).toISOString());
  const id = Number(res.lastInsertRowid);
  addEvent(ctx, id, "attempt_started");
  return stepAttemptView(ctx, id);
}

export function requestStepHint(ctx: Ctx, attemptId: number): StepAttemptView {
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  const { step, choices } = attemptContext(ctx, row);
  const used = eventsOf(ctx, attemptId).filter((e) => e.kind === "hint_requested").length;
  if (used >= hintsFor(step, choices).length) throw new ServiceError(409, "No more hints. You can look at the reference solution if you need to.");
  addEvent(ctx, attemptId, "hint_requested", { index: used });
  return stepAttemptView(ctx, attemptId);
}

async function check(ctx: Ctx, row: StepAttemptRow) {
  const { pRow, step } = attemptContext(ctx, row);
  if (!existsSync(pRow.folder)) throw new ServiceError(409, `Your project folder ${pRow.folder} doesn't exist any more.`);
  return runProjectChecks(pRow.folder, { acceptanceTests: step.acceptanceTests, startsApp: step.meta.startsApp });
}

/** Runs the checks against your project folder as it is right now. As often as you like. */
export async function runStepChecks(ctx: Ctx, attemptId: number): Promise<ProjectCheckResult> {
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  const result = await check(ctx, row);
  addEvent(ctx, attemptId, "check_run", { passed: result.passed, failed: result.failed, result });
  return result;
}

export async function submitStep(ctx: Ctx, attemptId: number, req: StepSubmitRequest): Promise<StepSubmitResponse> {
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  const { step, project } = attemptContext(ctx, row);
  const results = await check(ctx, row);
  const allPassed = results.failed === 0 && results.passed > 0;

  const evs = eventsOf(ctx, attemptId);
  const hintEvents = evs.filter((e) => e.kind === "hint_requested");
  const independence = classifyIndependence({
    maxHintIndex: hintEvents.length ? Math.max(...hintEvents.map((e) => Number(e.payload.index ?? 0))) : null,
    totalHints: hintEvents.length,
    solutionViewed: evs.some((e) => e.kind === "solution_viewed"),
    usedOutsideHelp: req.usedOutsideHelp,
  }) as Independence;

  const ts = now(ctx).toISOString();
  ctx.db.exec("BEGIN");
  try {
    ctx.db
      .prepare("INSERT INTO step_submissions (attempt_id, created_at, explanation, used_outside_help, results) VALUES (?, ?, ?, ?, ?)")
      .run(attemptId, ts, req.explanation, req.usedOutsideHelp ? 1 : 0, JSON.stringify(results));
    addEvent(ctx, attemptId, "submission", { passed: results.passed, failed: results.failed });
    if (allPassed) {
      ctx.db.prepare("UPDATE step_attempts SET status = 'passed', ended_at = ?, independence = ? WHERE id = ?").run(ts, independence, attemptId);
    }
    // Using a skill in your own project is evidence too ("project_use"). How strong depends on the help you had.
    const level = !allPassed ? 3 : independence === "independent" ? 4 : independence === "hinted" ? 3 : 2;
    const insert = ctx.db.prepare(
      "INSERT INTO evidence (skill_id, level, polarity, kind, context, ref_type, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const skill of step.meta.skills) {
      insert.run(skill, level, allPassed ? 1 : -1, allPassed ? "project_use" : "failed_attempt", project.meta.id, "step_attempt", String(attemptId), ts);
    }
    ctx.db.exec("COMMIT");
  } catch (err) {
    ctx.db.exec("ROLLBACK");
    throw err;
  }
  return { results, allPassed, independence, attempt: stepAttemptView(ctx, attemptId) };
}

/** Shows the reference solution for your choices. Recorded: it counts as solution_viewed. */
export function revealReference(ctx: Ctx, attemptId: number, confirm: boolean): StepAttemptView {
  if (!confirm) throw new ServiceError(400, "Viewing the reference needs explicit confirmation.");
  const row = getAttemptRow(ctx, attemptId);
  requireOpen(row);
  if (!eventsOf(ctx, attemptId).some((e) => e.kind === "solution_viewed")) addEvent(ctx, attemptId, "solution_viewed");
  return stepAttemptView(ctx, attemptId);
}

function referenceFiles(step: LoadedStep, key: string) {
  const dir = step.references.get(key);
  if (!dir) return [];
  const out: { path: string; content: string }[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === "node_modules") continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (statSync(full).size < 50_000) out.push({ path: relative(dir, full), content: readFileSync(full, "utf8") });
    }
  };
  walk(dir);
  return out;
}
