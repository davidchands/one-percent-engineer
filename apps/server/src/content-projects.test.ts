import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { loadContent, loadProjects, referenceKeys } from "./content.ts";

const skills = loadContent().skills;

const decision = (id: string, options: string[]) => ({
  id,
  title: `Pick a ${id}`,
  problem: "A real problem.",
  criteria: [
    { id: "a", label: "A", description: "a" },
    { id: "b", label: "B", description: "b" },
  ],
  options: options.map((o) => ({
    id: o,
    name: o,
    summary: o,
    strengths: ["s"],
    costs: ["c"],
    whenProsChooseIt: "w",
    newIdeas: [] as string[],
    relatedSkills: [] as string[],
    fit: { a: 3, b: 3 } as Record<string, number>,
  })),
  costOfChangingLater: "Low.",
});

const step = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  objective: "o",
  task: "t",
  requirements: ["r"],
  hints: ["1", "2", "3", "4"],
  commonMistakes: [],
  explanationCheckpoint: "e",
  ...extra,
});

/** Writes a one-project content folder and loads it. */
function load(opts: {
  decisions?: ReturnType<typeof decision>[];
  steps?: ReturnType<typeof step>[];
  items: Record<string, string>[];
}) {
  const root = mkdtempSync(join(tmpdir(), "1pe-projects-test-"));
  const p = join(root, "demo");
  mkdirSync(join(p, "decisions"), { recursive: true });
  writeFileSync(
    join(p, "project.yaml"),
    stringify({ id: "demo", title: "Demo", brief: "b", whatYouBuild: ["x"], milestones: [{ id: "m", title: "M", goal: "g", items: opts.items }] }),
  );
  for (const d of opts.decisions ?? []) writeFileSync(join(p, "decisions", `${d.id}.yaml`), stringify(d));
  for (const s of opts.steps ?? []) {
    mkdirSync(join(p, "steps", s.id, "reference", "default"), { recursive: true });
    writeFileSync(join(p, "steps", s.id, "step.yaml"), stringify(s));
    writeFileSync(join(p, "steps", s.id, "acceptance.test.js"), "");
  }
  try {
    return loadProjects(root, skills);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("reference keys cover every combination of the chosen options, in dependsOn order", () => {
  const decisions = new Map([
    ["server", decision("server", ["express", "fastify"])],
    ["storage", decision("storage", ["json-file", "sqlite"])],
  ]);
  assert.deepEqual(referenceKeys([], decisions), ["default"]);
  assert.deepEqual(referenceKeys(["server"], decisions), ["express", "fastify"]);
  assert.deepEqual(referenceKeys(["server", "storage"], decisions), [
    "express+json-file",
    "express+sqlite",
    "fastify+json-file",
    "fastify+sqlite",
  ]);
});

test("the real reading-list project loads, in milestone order", () => {
  const project = loadContent().projects.get("reading-list");
  assert.ok(project);
  assert.deepEqual(
    project.order.filter((o) => o.kind !== "checkpoint"),
    [
      { kind: "decision", id: "server-framework" },
      { kind: "step", id: "first-route" },
      { kind: "step", id: "add-books" },
      { kind: "decision", id: "storage" },
      { kind: "step", id: "persist-books" },
      { kind: "step", id: "validate-books" },
      { kind: "step", id: "change-books" },
      { kind: "step", id: "serve-page" },
    ],
  );
  assert.deepEqual([...project.steps.get("first-route")!.references.keys()], ["express", "fastify", "node-http"]);
  assert.equal(project.steps.get("serve-page")!.references.size, 6, "3 servers × 2 storage options");
});

test("a step can't depend on a decision the learner hasn't made yet", () => {
  assert.throws(
    () =>
      load({
        decisions: [decision("server", ["express", "fastify"])],
        steps: [step("first", { dependsOn: ["server"] })],
        items: [{ step: "first" }, { decision: "server" }],
      }),
    /depends on decision server, which must come before it/,
  );
});

test("every option must be rated on every criterion", () => {
  const d = decision("server", ["express", "fastify"]);
  d.options[1]!.fit = { a: 3 };
  assert.throws(() => load({ decisions: [d], items: [{ decision: "server" }] }), /option fastify has no fit for b/);
});

test("per-option notes must belong to an option the step depends on", () => {
  assert.throws(
    () =>
      load({
        decisions: [decision("server", ["express", "fastify"])],
        steps: [step("first", { dependsOn: ["server"], variants: { koa: { notes: "n" } } })],
        items: [{ decision: "server" }, { step: "first" }],
      }),
    /has notes for koa/,
  );
});

test("a step that no milestone lists is an error, not silently ignored", () => {
  assert.throws(() => load({ steps: [step("first"), step("orphan")], items: [{ step: "first" }] }), /step orphan isn't in any milestone/);
});
