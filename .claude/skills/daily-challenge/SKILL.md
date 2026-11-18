---
name: daily-challenge
description: Generate new 1% Engineer coding challenges pitched at the learner's current level, from their real progress. Use when asked to "make today's challenge", "generate a new challenge", "give me more challenges", "add challenges on <skill>", or "/daily-challenge [count] [skill]". Writes a complete challenge folder under content/challenges/, proves it with the content validator, and loads it into the running app.
---

# Daily challenge generator

You are writing practice material for **the person you're talking to**. They are the learner.
That has two consequences that override everything else:

- **Never show them the solution, hidden tests or wrong solutions in chat**, and don't describe
  how to solve it. Report the title, the concept and why you chose it — nothing that gives it away.
- **Pitch it at what they can actually do now**, judged from evidence (step 1), not from what
  would be impressive.

Arguments (all optional): a count (`3` → make three, one at a time), and/or a skill id
(`js.arrays`) to force the topic. With no arguments, make one challenge and choose the topic yourself.

## 1. Read the learner's progress

```bash
node .claude/skills/daily-challenge/scripts/progress.mjs
```

If it says the server isn't answering, tell the user to run `pnpm autostart:start` and stop.

Read from the snapshot:
- `challenges[]`: status, `independence` (`independent` > `hinted` > `assisted` > `solution_viewed`),
  `hintsUsed`, `lastFailedTests`, `lastExplanation`.
- `skills[]`: `failures`, `coveredByAChallenge`, `prerequisites`, `phase`.
- `unpassedQueue`: challenges already waiting.

Also list `content/challenges/` and skim 2–3 existing `challenge.yaml` files at the target
difficulty, so you match their tone and don't repeat a scenario.

## 2. Decide what to make

**Queue check.** If `unpassedQueue` already has 3+ challenges at the learner's current difficulty,
say so: "You have N waiting: <titles>." Make a new one anyway only if the user asked explicitly.

**Difficulty**: the learner's *current difficulty* is the lowest difficulty that still has unpassed
challenges or has fewer than 3 passes. Then:
- Stay there by default.
- **Step up one** only when 3+ challenges at the current difficulty were passed as `independent`
  or `hinted` with ≤ 2 hints, and none of the recent ones was `assisted`/`solution_viewed`.
- **Reinforce** (same difficulty, same skill, new real-world context) when the most recent attempt
  on a skill was `assisted` or `solution_viewed`, used 3+ hints, or that skill has `failures` ≥ 2.
  Reinforcing is the most valuable challenge you can make: prefer it over new topics.

**Skill**: in priority order:
1. The skill the user named.
2. A skill that needs reinforcing (above).
3. The lowest-phase skill with `coveredByAChallenge: false` whose `prerequisites` are each either
   passed by the learner or taught by a challenge already in their queue (so they'll meet it first).
   Skills with no prerequisites are always ready. If several qualify, pick the one earliest in
   `content/skills/*.yaml`.
4. A combination of two skills the learner has passed, applied to a new problem (transfer).

Use only skill ids that exist in `content/skills/*.yaml`. **Never add or edit skill nodes**:
the skill graph is the learner's own task (e.g. `js.closures` is their task T0.1).

**Language**: JavaScript only, for phases 1–4. Use the `ts.*` skills (phase 5) only if the user
asks for TypeScript or every one of their prerequisites has been passed.

## 3. Write the challenge

Create `content/challenges/<id>/` (kebab-case id, not already used) with exactly these files.
The best reference for a beginner challenge is `content/challenges/cart-total/`, and for difficulty 2+
it's `content/challenges/printing-cost/`. Read the matching one before writing.

| File | Purpose |
|---|---|
| `challenge.yaml` | Everything the learner reads. Schema: `ChallengeMeta` in `packages/contracts/src/index.ts`. |
| `starter.js` | The exported function with an empty body (`// your code here`). It must FAIL the tests. |
| `public.test.js` | 2–3 tests the learner can see, matching the `examples`. |
| `hidden.test.js` | 4–8 tests for edge cases and boundaries. |
| `solution.js` | A clear reference solution written in the style taught at this level. |
| `wrong/<mistake>.js` | 2–4 realistic wrong solutions, one per mistake in `commonMistakes`. |

Tests use `node:test` + `node:assert/strict` and import from `"./solution.js"`. Name every test
after the behaviour it checks ("the last item is counted"), because the learner only sees the
name of a failing hidden test.

### challenge.yaml fields

`id`, `title`, `type` (usually `implement`; also `debug`, `refactor`, `algorithm`),
`difficulty` 1–5, `sequence` (one more than the highest `sequence` already used at that difficulty),
`context` (the real-world domain, e.g. `shopping`), `skills`, `targetLevel` (3 for practice,
4 when it's meant to be done without hints), `objective` (one sentence: what they'll be able to do),
`lesson` (required at difficulty 1, recommended at 2), `problem`, `requirements`, `constraints`,
`examples` (`input`/`output` strings), `edgeCasesToConsider`, `beforeCoding`, `hints` (exactly 4),
`commonMistakes`, `explanationCheckpoint`, `rubric`.

The `lesson` has: `concept`, `realWorldProblem`, `whyItExists`, `howItWorks`,
`example: {code, explanation}`, `predict: {code, question, answer, why}`, `commonMistake`.

### Teaching rules (these make it a good challenge, not just a valid one)

- **One new idea per challenge.** Everything else in it must be something they've already passed.
- **Only use syntax they've met.** At difficulty 1, that means `let`/`const`, arithmetic, comparisons,
  `if`/`else`, `for` loops, functions with `return`, string indexing and `.length`. No arrow functions,
  `.map`/`.reduce`, destructuring, classes or regex unless that's the concept being taught. If the
  constraint matters, say it in `constraints` ("Use a for loop, not .reduce").
- **A real problem first.** The `realWorldProblem` and `problem` describe a situation someone
  actually has (a shop, a school, a gym, a bus timetable) in plain words, not "write a function that
  takes an array". Use a context that no existing challenge uses.
- **The worked example teaches the concept on a *different* problem**, so it can't be copied.
- **The prediction must be non-obvious.** It should catch the misconception you're targeting
  (an off-by-one, a boundary, an operator precedence surprise), and `why` explains it.
- **Hints go from gentle to specific**: 1 = a question that points at the idea; 2 = which tool to use;
  3 = the exact thing that's usually wrong; 4 = the shape of the code with blanks, never the full solution.
- **Edge cases and "before coding" are questions, not answers.**
- **Hidden tests are fair.** Every hidden test must follow from something stated in `problem`,
  `requirements` or `examples`. If a boundary matters (is 12 a child or an adult?), the problem says so.
- **Use whole numbers for money** (cents), as the existing challenges do.
- **Plain English.** Short sentences, define any term the first time you use it.

## 4. Prove it

```bash
pnpm validate:content
```

All challenges must show `✓`. If a `wrong/` solution passes, the tests are too weak: **add a test
that catches it** (one that's fair by the rule above). Never delete the wrong solution or weaken a
test to get a pass. If the reference solution fails, fix whichever of the two is wrong.

Then make sure the existing app tests still pass:

```bash
pnpm --filter @1pe/server test
```

## 5. Load it into the app

The server reads content when it starts, so restart it:

```bash
pnpm autostart:restart
```

(If the user runs `pnpm dev` instead, it reloads on its own.)

## 6. Report

Tell the user, briefly:
- the title and the concept it practises (no solution details);
- **why this one**, citing the evidence ("you used 3 hints on Cinema ticket prices, so this is more
  practice with boundaries in a new setting");
- where it sits: challenges run easiest first, so it appears after any unpassed challenges at the
  same difficulty. Name what comes before it, if anything.

Don't commit. The user commits when they choose to.

For a count of more than one, repeat steps 2–4 for each challenge (vary the skill or context
between them), then restart and report once.
