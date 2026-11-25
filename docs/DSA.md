# Data structures and algorithms track

Interview preparation for big-tech roles, built on the same challenge system as everything else.

**Status:** PR 1 (the skill graph and ten starter problems) and PR 2 (interview mode) are done. Next: a
`/dsa-challenge` generator and more problems.

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

## Interview mode

Every DSA problem has a planning step, shown above the editor once you start an attempt:

1. **Plan before you code.** Choose the technique (from all 24, with the right one unmarked), the time
   cost and the memory cost. After you commit, it shows which parts were right and what the best
   solution costs. One try per attempt, and the answer is only revealed after you commit.
2. **Race the clock (optional).** Start a 20, 30 or 45 minute countdown. It never stops you; it records
   whether you passed in time.
3. **The Interview page** (nav bar) shows:
   - **Due for review:** problems you solved come back after 1, 3, 7, 14, 30 and 60 days (each pass
     pushes the next review further out). Re-solving is a new attempt.
   - **Pattern map:** for each technique, how many problems you solved and the share of your plans
     where you named the technique, the time cost and the memory cost correctly, plus the techniques
     you mis-name most.

A problem becomes an interview problem by adding this to its `challenge.yaml`. The answers never reach
the browser:

```yaml
interview:
  pattern: dsa.two-pointers      # a skill id
  timeComplexity: O(n)           # O(1), O(log n), O(n), O(n log n), O(n²), O(n × k) or O(2ⁿ)
  spaceComplexity: O(1)
```

Plans and countdowns are stored as attempt events. They don't change your skill levels (that stays
with your solved/failed evidence).

## Writing a new problem

Follow the rules in `.claude/skills/daily-challenge/SKILL.md`, plus:

1. Put a `quick(fn, ms)` helper at the top of `hidden.test.js` (copy it from `matching-prices`).
2. Add a big-input test where the obvious approach is at least 5 times too slow.
3. Add a `wrong/` solution for that obvious approach.
4. Make the `explanationCheckpoint` ask for the time and memory cost.
5. Add the `interview:` block above so it appears in interview mode and the pattern map.
