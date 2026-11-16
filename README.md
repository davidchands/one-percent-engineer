# 1% Engineer

A personal engineering training system. One objective, one real challenge, one improvement a day.
It runs entirely on your machine.

## Run it

```bash
pnpm install
pnpm dev          # server on :4100, web app on http://127.0.0.1:5173
```

Other commands:

```bash
pnpm test:core          # the core rules: your M1 tasks (15 failing tests at the start, on purpose)
pnpm test               # everything
pnpm validate:content   # quality gate for skills and challenges
pnpm typecheck
```

VS Code extension: `pnpm vscode:install`, then see [docs/VSCODE.md](docs/VSCODE.md).

Requires Node ≥ 22.5 (uses the built-in `node:sqlite`) and pnpm.

## How it fits together

```
apps/web     (React + Vite) ──HTTP──┐
                                    ├──►  apps/server (Fastify)  ──►  packages/core       pure rules: mastery, selection
apps/vscode  (extension)    ──HTTP──┘           │                     packages/contracts  schemas + types shared by everything
                                                ├─► SQLite (data/1pe.sqlite): what YOU did, as an append-only evidence log
                                                ├─► content/: skills + challenges, as files in git
                                                └─► sandbox: runs your code against tests in a restricted Node process
```

**Principles:**
- **Deterministic core, AI at the edges.** Rules that decide your level are plain, tested functions. (AI arrives in M5 and will never write your level directly.)
- **One evidence log, many views.** Skill levels are *computed* from evidence every time, never stored, so modules can't contradict each other.
- **Every metric states its provenance:** `observed`, `manual` or `inferred`.
- **Content is code.** Challenges live in git and must pass `validate:content`, which proves the hidden tests catch known wrong solutions.
- **Honest about limits.** It can't see help from outside the app; you self-report it at submit time.

## Where to start

Read [docs/TASKS.md](docs/TASKS.md). Then do today's challenge before writing any code.

## Layout

| Path | What |
|---|---|
| `packages/contracts` | Zod schemas → shared types |
| `packages/core` | `independence.ts` (worked example), `mastery.ts` + `selector.ts` (**your tasks**) |
| `apps/server/src/services.ts` | every action, the layer the AI chat will call in M5 |
| `apps/server/src/runner.ts` | sandboxed test runner |
| `apps/server/src/db.ts` | schema + migrations |
| `apps/web/src/pages` | Today, Challenge, Challenges, Skills, Journal |
| `apps/vscode` | VS Code extension: sidebar, challenge files, tests, timers ([docs](docs/VSCODE.md)) |
| `content/skills` | the knowledge map |
| `content/challenges/<id>` | `challenge.yaml`, `starter.mjs`, `public.test.mjs`, `hidden.test.mjs`, `solution.mjs`, `wrong/` |
