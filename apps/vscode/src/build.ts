/**
 * The "Build" sidebar: your current Build by Learning step, with Run checks.
 *
 * The lesson, the decisions and the final submit-and-explain stay in the web app, where there is room
 * to read and think. This panel is for the loop you repeat while coding: see the task, run the checks,
 * read what failed, ask for a hint. It never reads or sends your project's files: the server runs
 * your app from the project folder it already knows.
 */
import * as vscode from "vscode";
import type { ProjectCheckResult, ProjectSummary, ProjectView, StepAttemptView, StepView } from "@1pe/contracts";
import { Api, ApiError } from "./api.ts";
import { PanelView, type Incoming } from "./view.ts";

export interface BuildState {
  status: "loading" | "offline" | "ready" | "error";
  error: string | null;
  /** The project this panel follows, once you've started one in the web app. */
  project: ProjectSummary | null;
  /** What's next on the roadmap. A decision is made in the web app; a step is built here. */
  next: ProjectView["next"];
  nextTitle: string | null;
  done: boolean;
  step: StepView | null;
  attempt: StepAttemptView | null;
  lastCheck: ProjectCheckResult | null;
  busy: string | null;
  notice: string | null;
}

export function activateBuild(context: vscode.ExtensionContext, api: Api, opts: { webUrl: () => string }) {
  const state: BuildState = {
    status: "loading", error: null, project: null, next: null, nextTitle: null, done: false,
    step: null, attempt: null, lastCheck: null, busy: null, notice: null,
  };

  const view = new PanelView(context.extensionUri, (m) => handleMessage(m), "build.js");
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("onePercent.build", view, { webviewOptions: { retainContextWhenHidden: true } }),
  );
  const push = () => view.update(state);

  function openWeb(path: string) {
    vscode.env.openExternal(vscode.Uri.parse(`${opts.webUrl().replace(/\/$/, "")}/#${path}`));
  }

  async function refresh() {
    try {
      const all = await api.projects();
      const remembered = context.workspaceState.get<string>("onePercent.buildProject");
      const project = all.find((p) => p.id === remembered && p.started) ?? all.find((p) => p.started) ?? null;
      state.project = project;
      state.step = null;
      state.attempt = null;
      state.next = null;
      state.nextTitle = null;
      state.done = false;
      if (project) {
        await context.workspaceState.update("onePercent.buildProject", project.id);
        const view = await api.project(project.id);
        state.next = view.next;
        state.done = view.next === null;
        const item = view.milestones.flatMap((m) => m.items).find((i) => (i.kind === "step" || i.kind === "decision") && i.id === view.next?.id);
        state.nextTitle = item && "title" in item ? item.title : null;
        if (view.next?.kind === "step") {
          state.step = await api.step(project.id, view.next.id);
          state.attempt = state.step.attempt && state.step.attempt.status === "in_progress" ? state.step.attempt : null;
          if (!state.attempt) state.lastCheck = null;
          else state.lastCheck = state.lastCheck ?? state.attempt.lastCheck;
        }
      }
      state.status = "ready";
      state.error = null;
    } catch (e) {
      state.status = e instanceof ApiError && e.unreachable ? "offline" : "error";
      state.error = (e as Error).message;
    }
    push();
  }

  async function act(label: string, fn: () => Promise<void>) {
    state.busy = label;
    state.notice = null;
    push();
    try {
      await fn();
    } catch (e) {
      state.notice = (e as Error).message;
      if (e instanceof ApiError && e.unreachable) state.status = "offline";
      vscode.window.showErrorMessage(`1% Engineer: ${state.notice}`);
    } finally {
      state.busy = null;
      push();
    }
  }

  const openAttempt = () => {
    if (!state.attempt) throw new Error("Start this step first.");
    return state.attempt;
  };

  async function startStep() {
    if (!state.project || state.next?.kind !== "step") throw new Error("There's no step to start yet.");
    if (state.step?.status === "blocked") throw new Error("Make the decision for this step first, in the web app.");
    if (!state.attempt) state.attempt = await api.startStep(state.project.id, state.next.id);
    await refresh();
  }

  async function runChecks() {
    const a = openAttempt();
    state.lastCheck = await api.stepRun(a.id);
    state.attempt = await api.stepAttempt(a.id);
  }

  const commands: Record<string, () => Promise<void>> = {
    "onePercent.build.refresh": () => refresh(),
    "onePercent.build.start": () => act("Starting…", startStep),
    "onePercent.build.run": () => act("Starting your app and running the checks…", runChecks),
    "onePercent.build.hint": () =>
      act("Revealing hint…", async () => {
        state.attempt = await api.stepHint(openAttempt().id);
      }),
    "onePercent.build.openFolder": async () => {
      const folder = state.project?.folder;
      if (!folder) throw new Error("Start the project in the web app first.");
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folder), { forceNewWindow: false });
    },
    "onePercent.build.openInBrowser": async () => {
      if (!state.project) return openWeb("/build");
      const n = state.next;
      openWeb(n ? `/build/${state.project.id}/${n.kind}/${n.id}` : `/build/${state.project.id}`);
    },
  };
  for (const [id, fn] of Object.entries(commands)) context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  async function handleMessage(msg: Incoming) {
    if (msg.type === "ready") return push();
    if (msg.type === "command" && msg.command && commands[msg.command]) return commands[msg.command]!();
  }

  const poll = setInterval(() => {
    if (!state.busy) refresh();
  }, 30_000);
  context.subscriptions.push({ dispose: () => clearInterval(poll) });
  refresh();
}
