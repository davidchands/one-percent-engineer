# Your tasks

This is "build it with me". The plumbing (server, database, sandbox, web app) exists so you can train **today**.
The parts that decide what 1% Engineer *believes about you* are yours to write.

**How to get help:** ask in chat. I'll start with questions and hints. Say "show me" explicitly if you want code.
**Rule:** don't edit a spec test to make it pass. If you disagree with a rule, argue it first (journal + chat),
then change the rule *and* its test together.

---

## Start here: train first (from today)

Do today's challenge in the app before writing any code for it. Use the thinking timer, write the journal entry.
The point of the tool is the training. Building it comes second.

---

## M0: The knowledge map

### T0.1 Write the `js.closures` skill node
**File:** `content/skills/phase-1-foundations.yaml`

- Decide its prerequisites. Which existing skills must be ≥ level 3 first? Why?
- Write a `why`: the real problem closures solve. Not "a function inside a function".
- Write objectives for levels 1–6 that are **concrete and checkable**. Compare yours with `js.objects`.
  A good objective names a task someone could watch you do.
- Run `pnpm validate:content`. It rejects unknown prerequisites and schema mistakes.

**Done when:** it validates, and you can say why each level's objective proves *that* level and not the one below.

### T0.2 Extend the graph to the rest of Phase 2
Add: `js.map-filter-reduce`, `ds.choosing-structures`, `algo.searching`, `algo.sorting`, `algo.complexity`,
`thinking.patterns`. Set `careerRelevance` from **real German job ads** you've read, not from guesses.

---

## M1: The core (the most important code in the project)

Run with `pnpm test:core`. Right now 15 tests fail: those are this milestone.

### T1.1 `projectSkillState` (`packages/core/src/mastery.ts`)
Rules R1–R10 are in the file header. Spec: `mastery.test.ts`.
**Write the "before coding" answers in your journal first.** Then make the tests pass one rule at a time,
in the order R1 → R10, running the tests after each.

**Done when:** all `R*` tests pass, the Skills page shows real levels, and you can explain why R4 needs
*two different days* (what is it protecting against?).

### T1.2 `selectNextActivity` (`packages/core/src/selector.ts`)
Rules S1–S6 in the file header. Spec: `selector.test.ts`.
The rationale text is user-facing: write it so that *you*, reading it tomorrow morning, understand why.

**Done when:** all `S*` tests pass, and the Today page shows an evidence-based reason instead of the placeholder notice.

> When the core is done, the plan for a day is computed when you first open Today. To see a new pick, delete
> today's row: `sqlite3 data/1pe.sqlite "DELETE FROM daily_plans WHERE date = date('now')"`.

---

## M1.5: Your first authored challenge

### T1.3 Write a challenge that passes the quality gate
Pick a Phase 1 skill no current challenge covers (e.g. `js.scope`). Create `content/challenges/<id>/` with
`challenge.yaml`, `starter.mjs`, `public.test.mjs`, `hidden.test.mjs`, `solution.mjs`, and at least 2 files in `wrong/`.

The hard part is `wrong/`: write the mistakes a learner would *really* make, then make sure your hidden tests catch them.
(While building this tool, the gate caught a mistake in one of my own challenges. See the tie-breaking test in `debug-grade-report`.)

**Done when:** `pnpm validate:content` shows ✓ for it.

---

## M4 extension tasks (the extension exists; these extend it)

### T4.1 Active coding time (inferred)
Today the extension only reports *first edit*. Add an **active time** metric: time when VS Code is focused AND
you've edited or moved the cursor in `solution.mjs` within the last 2 minutes.
- Where: `apps/vscode/src/extension.ts` (events: `window.onDidChangeWindowState`, `onDidChangeTextEditorSelection`),
  plus a new `active_time` event kind in `@1pe/contracts` and `services.ts`.
- It must be labelled `inferred`, and its caveat must say what it can't tell you.
- Before coding: what goes wrong if you send an event on every keystroke? How will you batch?

**Done when:** active time shows in the process metrics, labelled `inferred`, and works offline (queued) without double-counting.

### T4.2 Count debug sessions
Use `debug.onDidStartDebugSession` to record debugging iterations for the current challenge (observed).

---

## Up next (we'll plan each when you get there)

| Milestone | What | You'll learn |
|---|---|---|
| M5 | AI mentor: explanation grading, Socratic hints, chat that calls the services | LLM integration, schemas, reliability |
| M6 | Challenge generator through the same quality gate + spaced reviews | Pipelines, test design |
| M7 | Weekly review + intelligence dashboard (after ~4 weeks of data) | Metric design, honest visualisation |

Known limitations to fix along the way (good challenges in their own right):
- The sandbox doesn't block network access (Node 22's permission model doesn't cover it).
- Repeated failing *submissions* each create negative evidence. Iterate with "Run visible tests"; submit when you think you're done.
- The VS Code extension has no automated UI tests yet: only unit tests for its pure modules.
