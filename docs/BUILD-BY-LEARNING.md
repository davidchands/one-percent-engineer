# Build by Learning

Build one real full-stack app, one milestone at a time, learning each idea as you need it.
When the project needs a technology choice, the app **teaches you the options and you decide**.
It never chooses for you.

Status: **All five PRs are done: foundation, server and the Build tab, the reading-list project, the
VS Code Build panel, and the `/build-step` skill.** The rest of
this page is the approved plan.

**What PR 4 shipped:** a Build panel in the VS Code sidebar with the current step, Run checks, hints
and Open project folder. Decisions and submitting stay in the web app.

**What PR 5 shipped:** `/build-step` (in `.claude/skills/build-step`), which adds a step, a new option
for a decision, or a whole project, with reference and wrong-answer snapshots, and proves it with
`pnpm validate:content`. Like `/daily-challenge` it never shows solutions in chat and never makes
the learner's decisions.

**What PR 3 shipped:** six milestones (server, add books, storage, input checking, change and
remove, a page), two decisions (server framework; storage: JSON file or SQLite), six steps with
30 reference solutions, and five new skill nodes (`web.http`, `web.rest-api`, `data.persistence`,
`web.validation`, `web.html-forms`). The milestones for connecting the page to the API in depth
and for shipping are not written yet. The page step only checks the page's structure (the plan's
"lightweight frontend checks"), so you open it in a browser to see it work.

## How a project works

A **project** is a brief ("a reading-list app") split into **milestones**. A milestone is a list of
steps, and a step is one of three kinds:

| Step | What happens | What is recorded |
|---|---|---|
| **Learn and build** | A lesson, then a task on *your* project ("add a `GET /api/books` route"). You run the checks, ask for hints, then submit and explain, like a challenge. | The same independence classes as challenges, plus `project_use` evidence |
| **Decision** | You're taught the options for one choice, then you pick one and say why. | A decision record, also written into your project as `docs/decisions/NNNN-<id>.md` |
| **Checkpoint** | You explain how the pieces connect ("what happens when you click Save?"). | An explanation |

## Decision steps

A decision card shows:

- **The problem it solves**, in plain words.
- **2–4 options**, each with what it is, strengths, costs and when professionals choose it.
- **What it costs *you***: the new ideas each option needs, checked against your skill evidence
  ("Express: 1 new idea. React: 4, and you haven't passed arrays yet").
- **"What matters to you?"**: you weight a few criteria, and it shows how each option fits them.
  Nothing is pre-selected.
- **Your decision**: you pick, and write *why* in a sentence or two.
- **Changing your mind is allowed.** It tells you which steps you'd redo. Decisions are an
  append-only history, like evidence.

## Checks test behaviour, not code

Your stack can differ from someone else's, so checks never look at *how* you wrote something.
The project runner starts your app and the checks test what it **does** ("`GET /api/books` answers
with a JSON list"). One set of checks works whether you chose Express or Fastify. Only the lesson
notes, the hints and the reference solution change per option.

### Conventions your project follows

- It has a `package.json` with a `start` script (`"start": "node server.js"`).
- The server listens on the port in `process.env.PORT`.

These are the same conventions real hosting platforms use, so the project is deployable later.

## Content format

```
content/projects/
  package.json                  dependencies the reference solutions use (express, fastify)
  <project-id>/
    project.yaml                brief, prerequisites, milestones (steps and decisions, in order)
    decisions/<id>.yaml         the problem, criteria, and 2–4 options
    steps/<id>/
      step.yaml                 lesson, task, requirements, hints, per-option notes
      acceptance.test.js        behaviour checks (node:test; BASE_URL and PROJECT_DIR are set)
      reference/<option>/       a complete project snapshot after this step, per option
      wrong/<mistake>/          optional snapshots with a realistic mistake
```

A step's reference folders are named after the options of the decisions in its `dependsOn`
(`express`, or `express+sqlite` for two), or `default` when it depends on none.

## The quality gate

`pnpm validate:content` also checks every project step:

1. Every reference snapshot **passes** the step's checks.
2. The snapshot from **before** the step (the previous step's reference for the same options, or an
   empty folder for the first step) **fails** them, so the step really asks for something new.
3. Every `wrong/` snapshot fails at least one check.
4. Every decision a step depends on comes earlier in the project, and every option has a reference.

## The project runner

`apps/server/src/project-runner.ts`:

1. Reads the `start` script from the project's `package.json`.
2. Picks a free port and starts the app with `PORT` set.
3. Waits until the app answers on `127.0.0.1` or `[::1]` (max 10 s). If the app exits first, it
   reports the app's own error output.
4. Runs the step's checks against it (max 10 s), then stops the app and everything it started.

It is less locked down than the challenge sandbox, because a server needs network and process
access. It only runs your own project on your own machine.

## Delivery

1. **Foundation**: contracts, content format, loader, project runner, validator, one proof step.
   No UI.
2. **Server and web UI**: database tables (`projects`, `project_decisions`), API, the **Build**
   tab, roadmap, decision cards and step pages.
3. **First project content**: the reading-list app, about 8 milestones (page → interactivity →
   server → REST API → storage → connecting frontend and API → errors and validation → shipping).
4. **VS Code panel**: current step and **Run checks**.
5. *(Optional)* A `/build-step` Claude skill that writes notes, hints and references for a new
   option or project, through the same gate.

## Decisions taken for now (change any of them)

- **First project:** a reading list (books you want to read, are reading, have read).
- **Skill nodes:** PR 1 adds none. New `web.*` / `data.*` nodes are decided before PR 3.
- **Unlocking:** projects are open, with a heads-up listing prerequisite skills you haven't
  practised in a challenge yet.
- **Frontend checks:** lightweight (files and HTML structure) first; a real browser later if needed.
