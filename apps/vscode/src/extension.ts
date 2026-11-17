/**
 * 1% Engineer for VS Code.
 *
 * What it does:
 *  - Shows today's challenge in a sidebar (brief, hints, tests, metrics, submission).
 *  - Creates challenge files ONLY inside the challenges folder (default ~/Documents/1pe-practice/<id>/).
 *  - Runs the visible tests and submits through the local server, so results match the web app.
 *  - Records first-edit time for challenge files only, with a visible on/off switch.
 *
 * What it never does:
 *  - Modify files outside the challenges folder, except the task comment you explicitly request
 *    (applied as an unsaved, undoable edit you can inspect).
 *  - Read or send any file other than the challenge's solution.js, and only when you run/submit.
 */
import * as vscode from "vscode";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AttemptResponse, ChallengePublic, TestRunResult, TodayResponse, Independence } from "@1pe/contracts";
import { Api, ApiError } from "./api.ts";
import { placeTaskComment, renderTaskComment, stripLeadingComment } from "./markers.ts";
import { challengeDir, challengeIdForFile, expandHome } from "./paths.ts";
import { TodayView } from "./view.ts";

export interface ViewState {
  status: "loading" | "offline" | "ready" | "error";
  error: string | null;
  today: TodayResponse | null;
  challenge: ChallengePublic | null;
  attempt: AttemptResponse | null;
  lastRun: TestRunResult | null;
  lastSubmit: { allPassed: boolean; independence: Independence } | null;
  filesExist: boolean;
  trackingEnabled: boolean;
  isToday: boolean;
  busy: string | null;
  notice: string | null;
}

const cfg = () => vscode.workspace.getConfiguration("onePercent");
const challengesRoot = () => expandHome(cfg().get<string>("challengesDir", "~/Documents/1pe-practice"));

export function activate(context: vscode.ExtensionContext) {
  const api = new Api(() => cfg().get<string>("serverUrl", "http://127.0.0.1:4100"));
  const output = vscode.window.createOutputChannel("1% Engineer");
  /** Everything this extension has sent to the server this session. Shown by "Show Data Collected". */
  const sentLog: { at: string; what: string }[] = [];

  const state: ViewState = {
    status: "loading",
    error: null,
    today: null,
    challenge: null,
    attempt: null,
    lastRun: null,
    lastSubmit: null,
    filesExist: false,
    trackingEnabled: cfg().get<boolean>("trackingEnabled", true),
    isToday: true,
    busy: null,
    notice: null,
  };

  const view = new TodayView(context.extensionUri, (msg) => handleMessage(msg));
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("onePercent.today", view, { webviewOptions: { retainContextWhenHidden: true } }));

  /* -------------------------- status bar -------------------------- */

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.command = "workbench.view.extension.onePercent";
  const timerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  timerItem.command = "onePercent.toggleTimer";
  context.subscriptions.push(statusItem, timerItem, output);

  const thinking = () => state.attempt?.metrics.find((m) => m.key === "thinking");
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  function renderStatus() {
    const title = state.challenge?.title;
    if (state.status === "offline") {
      statusItem.text = "$(debug-disconnect) 1% offline";
      statusItem.tooltip = "1% Engineer server not running. Start it with `pnpm dev`.";
    } else {
      const done = state.attempt?.status === "passed";
      statusItem.text = `${state.trackingEnabled ? "$(beaker)" : "$(debug-pause)"} 1%${title ? `: ${title.length > 32 ? title.slice(0, 31) + "…" : title}` : ""}${done ? " ✓" : ""}`;
      statusItem.tooltip = `${title ?? "1% Engineer"}\nTracking ${state.trackingEnabled ? "ON (challenge files only)" : "PAUSED"}`;
    }
    statusItem.show();

    const t = thinking();
    if (state.attempt?.status === "in_progress" && t) {
      const running = Boolean(t.runningSince);
      const ms = (t.valueMs ?? 0) + (running ? Date.now() - new Date(t.runningSince!).getTime() : 0);
      timerItem.text = running ? `$(clock) thinking ${fmt(ms)}` : `$(watch) ${ms ? fmt(ms) : "timer"}`;
      timerItem.tooltip = running ? "Thinking timer running. Click to pause." : "Start the thinking timer (manual)";
      timerItem.backgroundColor = running ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
      timerItem.show();
    } else timerItem.hide();
  }
  const ticker = setInterval(renderStatus, 1000);
  context.subscriptions.push({ dispose: () => clearInterval(ticker) });

  function push() {
    view.update(state);
    renderStatus();
  }

  /* -------------------------- loading state -------------------------- */

  const solutionPath = (id: string) => join(challengeDir(challengesRoot(), id), "solution.js");
  let currentId: string | null = context.workspaceState.get<string>("onePercent.currentChallenge") ?? null;

  async function refresh(challengeId?: string) {
    try {
      state.today = await api.today();
      const todayId = state.today.primary?.challenge.id ?? null;
      currentId = challengeId ?? currentId ?? todayId;
      if (!currentId) {
        Object.assign(state, { status: "ready", challenge: null, attempt: null, error: null });
        return push();
      }
      state.challenge = await api.challenge(currentId);
      const attempts = await api.attempts(currentId);
      const pick = attempts.find((a) => a.status === "in_progress") ?? attempts[0];
      state.attempt = pick ? await api.attempt(pick.id) : null;
      state.filesExist = existsSync(solutionPath(currentId));
      state.isToday = currentId === todayId;
      state.status = "ready";
      state.error = null;
      if (state.attempt?.status !== "in_progress") state.lastRun = state.attempt?.lastSubmission?.results ?? null;
      await context.workspaceState.update("onePercent.currentChallenge", currentId);
    } catch (e) {
      state.status = e instanceof ApiError && e.unreachable ? "offline" : "error";
      state.error = (e as Error).message;
    }
    push();
  }

  /** Runs an action with a busy indicator and turns failures into visible messages. */
  async function act(label: string, fn: () => Promise<void>) {
    state.busy = label;
    state.notice = null;
    push();
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error).message;
      state.notice = msg;
      if (e instanceof ApiError && e.unreachable) state.status = "offline";
      vscode.window.showErrorMessage(`1% Engineer: ${msg}`);
    } finally {
      state.busy = null;
      push();
    }
  }

  const requireOpenAttempt = () => {
    if (!state.attempt || state.attempt.status !== "in_progress") throw new Error("Start the challenge first.");
    return state.attempt;
  };

  /* -------------------------- commands -------------------------- */

  async function startOrOpen() {
    if (!state.challenge) await refresh();
    const ch = state.challenge;
    if (!ch) throw new Error("No challenge available. Is the server running?");

    if (!state.attempt || state.attempt.status !== "in_progress") {
      if (state.attempt?.status === "passed") {
        const again = await vscode.window.showInformationMessage(
          `You've already passed "${ch.title}". Start a new attempt?`,
          { modal: true },
          "New attempt",
        );
        if (again !== "New attempt") return openSolution(ch.id);
      }
      state.attempt = await api.startAttempt(ch.id);
      sentLog.push({ at: new Date().toISOString(), what: `started attempt #${state.attempt.id} on ${ch.id}` });
    }

    // Create files only if missing. Never overwrite your solution.
    const dir = challengeDir(challengesRoot(), ch.id);
    await mkdir(dir, { recursive: true });
    const sol = join(dir, "solution.js");
    if (!existsSync(sol)) {
      await writeFile(sol, `${renderTaskComment(ch)}\n\n${stripLeadingComment(ch.starterCode)}`);
    }
    const pub = join(dir, "public.test.js");
    if (!existsSync(pub)) await writeFile(pub, ch.publicTests);
    const pkg = join(dir, "package.json");
    if (!existsSync(pkg)) await writeFile(pkg, JSON.stringify({ type: "module", private: true, scripts: { test: "node --test" } }, null, 2) + "\n");
    await ensureNoAutocomplete();

    state.filesExist = true;
    await openSolution(ch.id);
  }

  async function openSolution(id: string) {
    const doc = await vscode.workspace.openTextDocument(solutionPath(id));
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  /** The practice folder gets a settings file that turns off AI autocomplete: your evidence should be yours. */
  async function ensureNoAutocomplete() {
    const settingsDir = join(challengesRoot(), ".vscode");
    const file = join(settingsDir, "settings.json");
    if (existsSync(file)) return;
    await mkdir(settingsDir, { recursive: true });
    await writeFile(
      file,
      JSON.stringify(
        {
          "//": "Created by 1% Engineer: AI completions off so your solutions (and your evidence) are your own.",
          "github.copilot.enable": { "*": false },
          "editor.inlineSuggest.enabled": false,
        },
        null,
        2,
      ) + "\n",
    );
  }

  async function readSolution(): Promise<string> {
    const ch = state.challenge!;
    const path = solutionPath(ch.id);
    const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === path);
    if (open?.isDirty) await open.save();
    if (!existsSync(path)) throw new Error("No solution.js yet. Use 'Start' to create the challenge files.");
    return readFile(path, "utf8");
  }

  async function runTests() {
    const attempt = requireOpenAttempt();
    const code = await readSolution();
    state.lastRun = await api.run(attempt.id, code);
    state.lastSubmit = null;
    sentLog.push({ at: new Date().toISOString(), what: `sent solution.js (${code.length} chars) for a test run` });
    state.attempt = await api.attempt(attempt.id);
    const r = state.lastRun;
    output.appendLine(`[${new Date().toLocaleTimeString()}] ${state.challenge?.id}: ${r.passed} passed, ${r.failed} failed${r.timedOut ? " (timed out)" : ""}`);
    for (const c of r.cases) output.appendLine(`  ${c.passed ? "✓" : "✗"} ${c.name}${c.message ? `\n      ${c.message.replace(/\n/g, "\n      ")}` : ""}`);
    vscode.window.setStatusBarMessage(`1%: ${r.passed} passed, ${r.failed} failed`, 4000);
  }

  async function submit(explanation?: string, usedOutsideHelp?: boolean) {
    const attempt = requireOpenAttempt();
    if (explanation === undefined) {
      explanation = await vscode.window.showInputBox({
        title: "Explanation checkpoint",
        prompt: state.challenge?.explanationCheckpoint.trim().replace(/\s+/g, " "),
        placeHolder: "In your own words (at least a few sentences)",
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length < 40 ? `At least 40 characters (${v.trim().length}/40)` : null),
      });
      if (explanation === undefined) return;
    }
    if (usedOutsideHelp === undefined) {
      const pick = await vscode.window.showQuickPick(["No, only 1% Engineer hints", "Yes: AI, web search or another person"], {
        title: "Did you use help from outside 1% Engineer? (It can't see this, so it only knows if you say.)",
        ignoreFocusOut: true,
      });
      if (!pick) return;
      usedOutsideHelp = pick.startsWith("Yes");
    }
    const code = await readSolution();
    const r = await api.submit(attempt.id, { code, explanation, usedOutsideHelp });
    sentLog.push({ at: new Date().toISOString(), what: `submitted solution.js and explanation for attempt #${attempt.id}` });
    state.lastRun = r.results;
    state.lastSubmit = { allPassed: r.allPassed, independence: r.independence };
    state.attempt = r.attempt;
    if (r.allPassed) {
      // Don't await: a notification with a button stays open until clicked, and awaiting it
      // would leave the panel stuck on "Submitting…" with the old (still-ticking) attempt.
      const title = state.challenge!.title;
      void vscode.window
        .showInformationMessage(`Passed (${r.independence.replace("_", " ")}). Write the journal entry while it's fresh.`, "Open journal")
        .then((choice) => {
          if (choice) openWeb(`/journal/new?attempt=${attempt.id}&title=${encodeURIComponent(title)}`);
        });
    }
  }

  async function viewSolution() {
    const attempt = requireOpenAttempt();
    const ok = await vscode.window.showWarningMessage(
      "Viewing the reference solution marks this attempt as 'solution viewed'. Passing afterwards counts as exposure, not ability.",
      { modal: true },
      "Show solution",
    );
    if (ok !== "Show solution") return;
    state.attempt = await api.solution(attempt.id);
    const doc = await vscode.workspace.openTextDocument({ language: "javascript", content: `// Reference solution (viewed, recorded)\n\n${state.attempt.solution ?? ""}` });
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
  }

  async function insertTaskComment() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error("Open the file you want the task comment in first.");
    if (!state.challenge) throw new Error("No challenge loaded.");
    const doc = editor.document;
    const placement = placeTaskComment(doc.getText(), renderTaskComment(state.challenge));
    const where = vscode.workspace.asRelativePath(doc.uri);
    const ok = await vscode.window.showInformationMessage(
      placement.action === "replaced"
        ? `Update the existing 1% Engineer task comment in ${where}? Nothing else in the file changes.`
        : `Insert the 1% Engineer task comment at the top of ${where}? Nothing else in the file changes, and you can undo it.`,
      { modal: true },
      placement.action === "replaced" ? "Update" : "Insert",
    );
    if (!ok) return;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, new vscode.Range(doc.positionAt(placement.start), doc.positionAt(placement.end)), placement.replacement);
    await vscode.workspace.applyEdit(edit); // left unsaved so you can review it
  }

  async function toggleTimer() {
    const attempt = requireOpenAttempt();
    const running = Boolean(thinking()?.runningSince);
    state.attempt = await api.event(attempt.id, running ? "timer_pause" : "timer_start");
    sentLog.push({ at: new Date().toISOString(), what: `thinking timer ${running ? "paused" : "started"} (manual)` });
  }

  async function toggleTracking() {
    state.trackingEnabled = !state.trackingEnabled;
    await cfg().update("trackingEnabled", state.trackingEnabled, vscode.ConfigurationTarget.Global);
    vscode.window.setStatusBarMessage(`1% Engineer tracking ${state.trackingEnabled ? "resumed" : "paused"}`, 3000);
  }

  async function showCollectedData() {
    const content = [
      "# What 1% Engineer for VS Code sent this session",
      "",
      `Server: ${cfg().get("serverUrl")} (local only)`,
      `Challenges folder (the only folder observed): ${challengesRoot()}`,
      `Tracking: ${state.trackingEnabled ? "on" : "paused"}`,
      "",
      "## Events",
      ...(sentLog.length ? sentLog.map((l) => `- ${l.at}  ${l.what}`) : ["- nothing yet"]),
      "",
      "## Never collected",
      "- Files outside the challenges folder",
      "- Keystrokes, clipboard, terminal contents, other extensions' data",
      "- File contents, except solution.js when YOU run tests or submit",
    ].join("\n");
    const doc = await vscode.workspace.openTextDocument({ language: "markdown", content });
    await vscode.window.showTextDocument(doc, { preview: true });
  }

  function openWeb(path: string) {
    const base = cfg().get<string>("webUrl", "http://127.0.0.1:4100").replace(/\/$/, "");
    vscode.env.openExternal(vscode.Uri.parse(`${base}/#${path}`));
  }

  const commands: Record<string, () => Promise<void>> = {
    "onePercent.refresh": () => refresh(),
    "onePercent.start": () => act("Starting…", startOrOpen),
    "onePercent.runTests": () => act("Running tests…", runTests),
    "onePercent.hint": () =>
      act("Revealing hint…", async () => {
        state.attempt = await api.hint(requireOpenAttempt().id);
        sentLog.push({ at: new Date().toISOString(), what: "requested a hint" });
      }),
    "onePercent.toggleTimer": () => act("", toggleTimer),
    "onePercent.submit": () => act("Submitting…", () => submit()),
    "onePercent.viewSolution": () => act("", viewSolution),
    "onePercent.insertTaskComment": () => act("", insertTaskComment),
    "onePercent.toggleTracking": () => act("", toggleTracking),
    "onePercent.showCollectedData": showCollectedData,
    "onePercent.openInBrowser": async () => openWeb(state.challenge ? `/challenge/${state.challenge.id}` : "/"),
  };
  for (const [id, fn] of Object.entries(commands)) context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  /** Messages from the sidebar webview. */
  async function handleMessage(msg: { type: string; command?: string; explanation?: string; usedOutsideHelp?: boolean }) {
    if (msg.type === "ready") return push();
    if (msg.type === "command" && msg.command && commands[msg.command]) return commands[msg.command]!();
    if (msg.type === "submit") return act("Submitting…", () => submit(msg.explanation ?? "", Boolean(msg.usedOutsideHelp)));
    if (msg.type === "openJournal" && state.attempt && state.challenge) {
      return openWeb(`/journal/new?attempt=${state.attempt.id}&title=${encodeURIComponent(state.challenge.title)}`);
    }
    if (msg.type === "backToToday") {
      currentId = null;
      await context.workspaceState.update("onePercent.currentChallenge", undefined);
      return refresh();
    }
  }

  /* -------------------------- tracking -------------------------- */

  const firstEditSent = new Set<number>();
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!state.trackingEnabled || e.contentChanges.length === 0) return;
      const id = challengeIdForFile(challengesRoot(), e.document.uri.fsPath);
      const a = state.attempt;
      if (!id || id !== state.challenge?.id || !a || a.status !== "in_progress") return;
      const already = a.metrics.find((m) => m.key === "timeToFirstEdit")?.valueMs != null;
      if (already || firstEditSent.has(a.id)) return;
      firstEditSent.add(a.id);
      api
        .event(a.id, "first_edit")
        .then((updated) => {
          state.attempt = updated;
          sentLog.push({ at: new Date().toISOString(), what: "first edit in solution.js (time only, no content)" });
          push();
        })
        .catch(() => firstEditSent.delete(a.id));
    }),

    // Opening a file from another challenge's folder switches the sidebar to that challenge.
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      const id = editor ? challengeIdForFile(challengesRoot(), editor.document.uri.fsPath) : null;
      vscode.commands.executeCommand("setContext", "onePercent.inChallenge", Boolean(id));
      if (id && id !== currentId) refresh(id);
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("onePercent.trackingEnabled")) state.trackingEnabled = cfg().get<boolean>("trackingEnabled", true);
      if (e.affectsConfiguration("onePercent")) refresh();
    }),
  );

  const active = vscode.window.activeTextEditor;
  vscode.commands.executeCommand("setContext", "onePercent.inChallenge", Boolean(active && challengeIdForFile(challengesRoot(), active.document.uri.fsPath)));

  // Poll gently so the sidebar notices the server starting, or a submission made in the browser.
  const poll = setInterval(() => {
    if (!state.busy) refresh(currentId ?? undefined);
  }, 30_000);
  context.subscriptions.push({ dispose: () => clearInterval(poll) });

  refresh();
}

export function deactivate() {}
