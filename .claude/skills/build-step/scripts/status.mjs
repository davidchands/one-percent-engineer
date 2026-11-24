#!/usr/bin/env node
/**
 * Prints where the learner is in each Build by Learning project, for the build-step skill:
 * which decisions they made, which steps they passed, and what's next. Read-only.
 *
 *   node .claude/skills/build-step/scripts/status.mjs [baseUrl]
 */
const base = process.argv[2] ?? "http://127.0.0.1:4100";
const get = async (p) => {
  const r = await fetch(base + p);
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
  return r.json();
};

try {
  await get("/api/health");
} catch {
  console.error(`The 1% Engineer server isn't answering on ${base}. Start it with \`pnpm autostart:start\` (or \`pnpm dev\`).`);
  process.exit(1);
}

const out = [];
for (const s of await get("/api/projects")) {
  const p = await get(`/api/projects/${s.id}`);
  out.push({
    id: p.id,
    title: p.title,
    started: p.started,
    folder: p.folder,
    progress: s.progress,
    next: p.next,
    milestones: p.milestones.map((m) => ({
      id: m.id,
      items: m.items.map((i) =>
        i.kind === "decision" ? `decision ${i.id}: ${i.chosen ? i.chosen.optionId : "not decided"}`
        : i.kind === "step" ? `step ${i.id}: ${i.status}`
        : "checkpoint",
      ),
    })),
  });
}
console.log(JSON.stringify(out, null, 2));
