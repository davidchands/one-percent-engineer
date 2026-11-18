#!/usr/bin/env node
/**
 * Prints a learner snapshot for the daily-challenge skill: what's been passed, how much help it took,
 * which skills keep failing, and which skills no challenge covers yet.
 *
 *   node .claude/skills/daily-challenge/scripts/progress.mjs [baseUrl]
 *
 * Reads the local 1% Engineer API (default http://127.0.0.1:4100). Read-only.
 */
const base = process.argv[2] ?? "http://127.0.0.1:4100";

async function get(path) {
  const r = await fetch(base + path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

try {
  await get("/api/health");
} catch {
  console.error(`The 1% Engineer server isn't answering on ${base}. Start it with \`pnpm autostart:start\` (or \`pnpm dev\`).`);
  process.exit(1);
}

const [challenges, skills, today] = await Promise.all([get("/api/challenges"), get("/api/skills"), get("/api/today")]);

const rows = [];
for (const c of challenges) {
  const attempts = await get(`/api/challenges/${c.id}/attempts`);
  const latest = attempts[0] ? await get(`/api/attempts/${attempts[0].id}`) : null;
  rows.push({
    id: c.id,
    difficulty: c.difficulty,
    skills: c.skills,
    status: latest ? latest.status : "not started",
    independence: latest?.independence ?? null,
    attempts: attempts.length,
    hintsUsed: latest?.hints?.length ?? 0,
    hintsAvailable: latest?.hintCount ?? null,
    solutionViewed: Boolean(latest?.solution),
    lastFailedTests: latest?.lastSubmission?.results?.cases?.filter((x) => !x.passed).map((x) => x.name) ?? [],
    lastExplanation: latest?.lastSubmission?.explanation?.slice(0, 300) ?? null,
  });
}

const covered = new Set(challenges.flatMap((c) => c.skills));
const passed = rows.filter((r) => r.status === "passed");
const independentAt = (d) => passed.filter((r) => r.difficulty === d && r.independence === "independent").length;

const snapshot = {
  date: today.date,
  passedToday: today.stats.passedToday?.map((c) => c.id) ?? [],
  totals: { passed: passed.length, challenges: challenges.length },
  byDifficulty: [1, 2, 3, 4, 5].map((d) => ({
    difficulty: d,
    total: rows.filter((r) => r.difficulty === d).length,
    passed: passed.filter((r) => r.difficulty === d).length,
    passedIndependently: independentAt(d),
  })).filter((x) => x.total > 0),
  challenges: rows,
  skills: skills.map((s) => ({
    id: s.id,
    phase: s.phase,
    prerequisites: s.prerequisites,
    failures: s.failures,
    evidence: s.evidenceCount,
    coveredByAChallenge: covered.has(s.id),
  })),
  recentWeaknesses: today.weaknesses,
  unpassedQueue: rows.filter((r) => r.status !== "passed").map((r) => r.id),
};

console.log(JSON.stringify(snapshot, null, 2));
