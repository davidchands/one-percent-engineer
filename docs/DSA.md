# Data structures and algorithms track

Interview preparation for big-tech roles, built on the same challenge system as everything else.

**Status:** PR 1 of 3 is done (the skill graph and ten starter problems). Next: interview mode (pick the
pattern and the complexity before you code, a timer, a pattern map, spaced review of passed problems),
then a `/dsa-challenge` generator and more problems.

## What's in it

- **25 skills** in `content/skills/phase-4-dsa.yaml`, in dependency order: complexity, hash maps and
  sets, two pointers, sliding window, prefix sums, stacks, queues, linked lists, recursion, binary
  search, sorting, intervals, trees, binary search trees, heaps, tries, graphs (BFS and DFS),
  topological sort, shortest paths, union-find, backtracking, greedy, dynamic programming (1D and 2D)
  and bit manipulation. Each needs earlier JavaScript skills at level 3 first, so the app only offers
  a problem once you are ready for it.
- **10 starter problems** in `content/challenges/`, each with a lesson, hints, public and hidden tests,
  a reference solution and wrong solutions:

| Problem | Pattern |
|---|---|
| `matching-prices`, `first-repeated-order` | hash maps and sets |
| `balanced-brackets` | stacks |
| `pair-for-sale` | two pointers |
| `best-week-sales` | sliding window |
| `count-late-orders` | binary search |
| `merge-bookings` | intervals (and sorting) |
| `reverse-playlist` | linked lists |
| `fewest-transfers` | graphs (BFS) |
| `fewest-coins` | dynamic programming |

Everything is JavaScript. The problems are original, written for teaching, not copies of well-known
interview problems.

## Speed is part of the test

In an interview a slow answer is a wrong answer, so these problems check speed:

- A hidden test runs the function on a big input (tens or hundreds of thousands of items) and fails
  if it takes longer than a budget, with a name like "handles 60,000 prices quickly". A solution that
  does the work for every pair of items finishes only after seconds, so it fails.
- The sandbox stops a suite after 5 seconds. If your code is still running then, the hidden tests show
  "hidden tests ran out of time (5s)", which is also a failure.
- Every problem includes a correct-but-slow wrong solution, and `pnpm validate:content` proves the
  tests catch it, the same way it proves they catch wrong answers.

Budgets are generous (a good solution takes a few milliseconds and the budget is 300 to 500) so a
slow computer doesn't fail a correct answer.

## Writing a new problem

Follow the rules in `.claude/skills/daily-challenge/SKILL.md`, plus:

1. Put a `quick(fn, ms)` helper at the top of `hidden.test.js` (copy it from `matching-prices`).
2. Add a big-input test where the obvious approach is at least 5 times too slow.
3. Add a `wrong/` solution for that obvious approach.
4. Make the `explanationCheckpoint` ask for the time and memory cost.
