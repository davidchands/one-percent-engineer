---
name: build-step
description: Extend a 1% Engineer "Build by Learning" project. Writes a new step, a new option for an existing decision (for example another server library or database), or a whole new project, together with reference solutions and wrong-answer snapshots, and proves it with the content validator. Use when asked to "add a step", "add an option", "add Postgres as a storage choice", "write the next milestone", or "/build-step <what>". Writes under content/projects/ and loads it into the running app.
---

# Build step generator

You are writing material for **the person you're talking to**. They are the learner, and they build
the project themselves.

- **Never show them reference solutions, wrong snapshots or the acceptance tests in chat.** Report the
  title, what the step teaches and where it sits. Nothing that gives the code away.
- **Never make a decision for them.** Decisions are the learner's; you only write the options, the
  trade-offs and the notes. Don't touch their project folder or their saved choices.
- **Don't edit skill nodes** (`content/skills/*.yaml`) unless the user asks: the skill graph is theirs.
  Reference existing skill ids only. If a step needs a new idea no node covers, say so in your report.
- **JavaScript only** for phases 1–4. No TypeScript until they ask.

Arguments (all optional): what to add, such as `step: edit-a-book`, `option: postgres for storage` or
`project: habit-tracker`. With none, look at the status and propose the next missing piece.

## 1. See where things stand

```bash
node .claude/skills/build-step/scripts/status.mjs
```

If the server isn't answering, tell the user to run `pnpm autostart:start` and stop. It lists each
project's milestones, what the learner decided and passed, and what's next.

Then read the content you're extending. Everything lives under `content/projects/<project>/`:

| Path | What it is |
|---|---|
| `project.yaml` | The brief, prerequisites and milestones (steps, decisions, checkpoints in order) |
| `decisions/<id>.yaml` | One decision: the problem, criteria, 2–4 options, cost of changing later |
| `steps/<id>/step.yaml` | The lesson, task, requirements, hints, per-option `variants`, mistakes |
| `steps/<id>/acceptance.test.js` | The checks. They test behaviour over HTTP, never the learner's code |
| `steps/<id>/reference/<optionKey>/` | A full working project for each combination of options |
| `steps/<id>/wrong/<mistake>/` | Realistic wrong projects, each of which must fail |

Schemas: `ProjectMeta`, `Decision`, `ProjectStep` in `packages/contracts/src/index.ts`. Read the
nearest existing step and decision first (`steps/add-books` is a good model) and match their tone.

## 2. Decide the shape

- **A new step.** One new idea. It builds on the previous step's reference, so the last step's
  working project plus the new idea is the next reference. Put it in the right milestone in
  `project.yaml` and add a checkpoint question if the milestone ends there.
- **A new option on an existing decision.** Add it to `decisions/<id>.yaml` (with honest `costs`,
  `fit` scores for every criterion and `whenProsChooseIt`), then add a `variants.<option>` entry and
  a new `reference/<optionKey>/` for **every step that depends on that decision**. Option keys join
  the chosen options of the step's `dependsOn` decisions with `+`, in order (`express+sqlite`), or
  `default` when there are none. Every combination needs a reference, so adding one option to a
  decision with 3 options and a second decision with 2 means 2 new keys per step.
- **A new project.** Start from `project.yaml`, 3+ milestones that each end with something the
  learner can see working, and only then the steps.

Make the options *fair*: each must have real strengths and real costs. Don't write a decision
where one option is the obvious answer; if one is, it's not a decision, it's a default.

## 3. Write it

Teaching rules (same spirit as the challenges):

- **A real situation first.** The `task` describes what the app needs ("readers need to see the
  list"), not "implement a route".
- **Requirements are observable.** Each one is something a request can show. If you can't write a
  check for it, it isn't a requirement.
- **Hints go gentle to specific**: a question, then which tool, then the usual mistake, then the
  shape of the code with blanks, never the full solution. At least 3, and per-option hints in
  `variants` replace the general ones.
- **Common mistakes are real ones** a beginner makes, each with a `wrong/` snapshot that shows it.
- **Plain English.** Short sentences. Define each term the first time.
- **Acceptance tests use `BASE_URL`** (and `PROJECT_DIR` if they need to restart the app), `node:test`
  and `node:assert/strict`. Name each test after the behaviour it checks, because the learner sees
  only the name of a failing check. Tests never import from the learner's code.
- **Servers read `process.env.PORT`** and the project has a `package.json` `start` script.
- **YAML gotcha:** quote any list item that contains `: ` or starts with `{`, or the file won't parse.

## 4. Prove it

```bash
pnpm validate:content
```

The gate requires, for every step:

1. every `reference/<optionKey>/` **passes** all checks;
2. the previous step's reference (or an empty folder, for the first step) **fails**;
3. every `wrong/` snapshot **fails**.

If a wrong snapshot passes, the checks are too weak: add a fair check that catches it. Never delete a
wrong snapshot or weaken a check to get a pass. If a reference fails, fix whichever side is wrong.
Libraries the references use (express, fastify) resolve from `content/projects/node_modules`; add a new
one to `content/projects/package.json` and run `pnpm install`.

Then make sure the app still agrees with the content:

```bash
pnpm --filter @1pe/server test
```

The loader tests pin the reading list's milestone order and reference counts. If you changed that
project on purpose, update those expectations in `apps/server/src/content-projects.test.ts` and
`apps/server/src/projects.test.ts`.

## 5. Load it into the app

```bash
pnpm autostart:restart
```

(`pnpm dev` reloads on its own.) The Build tab and the VS Code Build panel show it straight away.

## 6. Report

Tell the user, briefly: what you added and what it teaches (no solution details), where it sits on
the roadmap, anything that changes for them (a step they passed may now show **redo** if its options
changed), and any skill node you think is missing.

Don't commit. The user commits when they choose to.
