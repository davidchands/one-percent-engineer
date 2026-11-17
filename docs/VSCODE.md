# 1% Engineer in VS Code

## Install / update

From the project root (after pulling changes, run it again to update):

```bash
pnpm vscode:install
```

Then reload VS Code (Cmd+Shift+P → "Developer: Reload Window"). The server must be running (`pnpm dev`) for the extension to work.

## Daily use

1. Click the **1% Engineer** icon in the activity bar (left edge). The sidebar shows today's challenge.
2. **Start challenge** creates `~/Documents/1pe-practice/<challenge-id>/` with:
   - `solution.js`: task comment + starter code. **This is the file you edit.**
   - `public.test.js`: the visible tests
   - `package.json`: so `node --test` works in that folder
3. Use **Thinking timer** while you plan, then code in `solution.js`.
4. **Run tests** (sidebar, the beaker icon in the view's title bar, or Cmd+Alt+T in a challenge file). Results appear in the sidebar and in the "1% Engineer" output channel. Running `node --test` in the folder gives the same visible results.
5. **Reveal next hint** if stuck. Same rules as the web app.
6. Write the **explanation checkpoint** in the sidebar and **Submit**. Hidden tests run on the server.
7. When you pass, it offers to open the journal entry in the browser.

**Tip:** open `~/Documents/1pe-practice` as your VS Code workspace while training. It includes a `.vscode/settings.json` that turns off AI completions, so your solutions are your own.

## Commands (Cmd+Shift+P → "1% Engineer")

| Command | What it does |
|---|---|
| Start / Open Today's Challenge | Starts or resumes the attempt; creates files if missing; opens `solution.js` |
| Run Visible Tests | Saves and sends `solution.js` to the server's sandbox |
| Reveal Next Hint | Progressive hints; 4+ count as assisted |
| Start/Pause Thinking Timer | Manual timer, also in the status bar |
| Submit for Evaluation | Explanation + honest outside-help answer, then hidden tests |
| Show Reference Solution | Asks first; records `solution_viewed` |
| Insert/Update Task Comment in Current File | Puts the marked task block at the top of the open file (asks first, unsaved, undoable; updates instead of duplicating) |
| Pause/Resume Activity Tracking | Stops first-edit tracking |
| Show Data Collected This Session | Everything the extension sent, plus what it never collects |
| Open Challenge in Browser | Opens the web app on this challenge |

## Privacy and file safety

- **Files are created only in the challenges folder** (`onePercent.challengesDir`). Existing files are never overwritten: starting again keeps your `solution.js`.
- **The only file content ever sent is `solution.js`**, and only when you run tests or submit.
- **Tracking** = the time of your first edit in `solution.js`. Nothing else, no keystrokes or content. It's visible in the status bar (beaker = on, pause icon = paused).
- The task comment in other files only happens when you run that command, after a confirmation, as an unsaved edit.
- Everything goes to `127.0.0.1`. Nothing leaves your machine.

## Settings

| Setting | Default |
|---|---|
| `onePercent.serverUrl` | `http://127.0.0.1:4100` |
| `onePercent.webUrl` | `http://127.0.0.1:5173` |
| `onePercent.challengesDir` | `~/Documents/1pe-practice` |
| `onePercent.trackingEnabled` | `true` |

## Developing the extension

```bash
cd apps/vscode
pnpm test        # unit tests (markers, paths) + end-to-end smoke test
pnpm watch       # rebuild on change
```

The smoke test (`test/smoke.test.cjs`) bundles the real extension, loads it with a fake `vscode`
module (`test/fake-vscode.cjs`), and drives every command against a real server it starts on a free port,
with a throwaway database and practice folder. It doesn't need `pnpm dev` and never touches your data.
When you add a command, add a step to it. If the extension starts using a new VS Code API, add it to the fake.

The fake models real VS Code behaviour that matters. In particular, a non-modal notification with buttons
**never resolves on its own**: awaiting one is the bug the smoke test now guards against.

To debug: open `apps/vscode` in VS Code and press F5 ("Run Extension"). Code layout:

| File | Role |
|---|---|
| `src/extension.ts` | commands, state, status bar, tracking |
| `src/view.ts` | sidebar webview provider (strict CSP) |
| `media/panel.js`, `media/panel.css` | sidebar rendering, using VS Code theme variables |
| `src/api.ts` | HTTP client (no `vscode` import, so it's testable) |
| `src/markers.ts` | task comment rendering and placement (pure, tested) |
| `src/paths.ts` | path safety checks (pure, tested) |
| `test/smoke.test.cjs`, `test/fake-vscode.cjs` | end-to-end smoke test and the fake VS Code API |
