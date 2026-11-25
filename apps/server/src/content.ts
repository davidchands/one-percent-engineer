/**
 * Loads content-as-code from /content:
 *   content/skills/*.yaml                 → skill graph
 *   content/challenges/<id>/challenge.yaml → metadata (validated by Zod)
 *   content/challenges/<id>/starter.js   → what you start with
 *   content/challenges/<id>/public.test.js → tests you can see
 *   content/challenges/<id>/hidden.test.js → tests you can't see (edge cases)
 *   content/challenges/<id>/solution.js  → reference solution, never sent unless requested
 *   content/challenges/<id>/wrong/*.js   → plausible wrong solutions; validation proves the tests catch them
 *
 *   content/projects/<id>/...            → Build by Learning projects (see loadProjects below)
 *
 * Invalid content fails loudly at startup instead of half-working.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { ChallengeMeta, Decision, ProjectMeta, ProjectStep, SkillNode } from "@1pe/contracts";

export const CONTENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../content");

export interface LoadedChallenge {
  meta: ChallengeMeta;
  /** Context domain, used to detect transfer (e.g. "retail"). */
  context: string;
  dir: string;
  starter: string;
  publicTests: string;
  hiddenTests: string;
  solution: string;
  wrongSolutions: { name: string; code: string }[];
}

export interface Content {
  skills: Map<string, SkillNode>;
  challenges: Map<string, LoadedChallenge>;
  projects: Map<string, LoadedProject>;
}

export function loadContent(dir = CONTENT_DIR): Content {
  const skills = new Map<string, SkillNode>();
  const skillsDir = join(dir, "skills");
  for (const file of readdirSync(skillsDir).filter((f) => f.endsWith(".yaml")).sort()) {
    const doc = parse(readFileSync(join(skillsDir, file), "utf8")) as { skills?: unknown[] };
    for (const raw of doc.skills ?? []) {
      const parsed = SkillNode.safeParse(raw);
      if (!parsed.success) throw new Error(`${file}: invalid skill\n${parsed.error.message}`);
      if (skills.has(parsed.data.id)) throw new Error(`${file}: duplicate skill id ${parsed.data.id}`);
      skills.set(parsed.data.id, parsed.data);
    }
  }
  for (const s of skills.values()) {
    for (const p of s.prerequisites) {
      if (!skills.has(p)) throw new Error(`skill ${s.id}: unknown prerequisite ${p}`);
    }
  }

  const challenges = new Map<string, LoadedChallenge>();
  const chDir = join(dir, "challenges");
  for (const id of readdirSync(chDir).sort()) {
    const d = join(chDir, id);
    if (!existsSync(join(d, "challenge.yaml"))) continue;
    const raw = parse(readFileSync(join(d, "challenge.yaml"), "utf8")) as Record<string, unknown>;
    const parsed = ChallengeMeta.safeParse(raw);
    if (!parsed.success) throw new Error(`challenge ${id}: invalid challenge.yaml\n${parsed.error.message}`);
    if (parsed.data.id !== id) throw new Error(`challenge ${id}: id in yaml must match folder name`);
    for (const s of parsed.data.skills) {
      if (!skills.has(s)) throw new Error(`challenge ${id}: unknown skill ${s}`);
    }
    const pattern = parsed.data.interview?.pattern;
    if (pattern && !skills.has(pattern)) throw new Error(`challenge ${id}: interview pattern ${pattern} is not a skill`);
    const read = (f: string) => readFileSync(join(d, f), "utf8");
    const wrongDir = join(d, "wrong");
    challenges.set(id, {
      meta: parsed.data,
      context: typeof raw.context === "string" ? raw.context : "general",
      dir: d,
      starter: read("starter.js"),
      publicTests: read("public.test.js"),
      hiddenTests: read("hidden.test.js"),
      solution: read("solution.js"),
      wrongSolutions: existsSync(wrongDir)
        ? readdirSync(wrongDir)
            .filter((f) => f.endsWith(".js"))
            .map((f) => ({ name: f, code: readFileSync(join(wrongDir, f), "utf8") }))
        : [],
    });
  }
  return { skills, challenges, projects: loadProjects(join(dir, "projects"), skills) };
}

/* ------------------------------------------------------------------ */
/* Build by Learning                                                   */
/* ------------------------------------------------------------------ */

export interface LoadedStep {
  meta: ProjectStep;
  dir: string;
  acceptanceTests: string;
  /**
   * Complete project snapshots after this step, keyed by the chosen options of the step's
   * dependsOn decisions joined with "+" (e.g. "express", "express+sqlite"), or "default".
   */
  references: Map<string, string>;
  /** Snapshots with a realistic mistake in them, which the checks must catch. */
  wrong: { name: string; dir: string }[];
}

export interface LoadedProject {
  meta: ProjectMeta;
  dir: string;
  decisions: Map<string, Decision>;
  steps: Map<string, LoadedStep>;
  /** Steps and decisions in the order the learner meets them. */
  order: ({ kind: "step"; id: string } | { kind: "decision"; id: string } | { kind: "checkpoint"; prompt: string })[];
}

/** Every combination of options for a list of decisions, as reference keys ("express+sqlite"). */
export function referenceKeys(dependsOn: string[], decisions: Map<string, Decision>): string[] {
  let keys = [[]] as string[][];
  for (const id of dependsOn) {
    const options = decisions.get(id)?.options.map((o) => o.id) ?? [];
    keys = keys.flatMap((k) => options.map((o) => [...k, o]));
  }
  return keys.map((k) => (k.length ? k.join("+") : "default"));
}

/** Parses a YAML file, naming the file when it isn't valid YAML. */
function readYaml(file: string): unknown {
  try {
    return parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${file.slice(CONTENT_DIR.length + 1)}: not valid YAML: ${(e as Error).message.split("\n")[0]}`);
  }
}

const subdirs = (d: string) =>
  existsSync(d) ? readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];

export function loadProjects(dir: string, skills: Map<string, SkillNode>): Map<string, LoadedProject> {
  const projects = new Map<string, LoadedProject>();
  for (const id of subdirs(dir)) {
    const d = join(dir, id);
    if (!existsSync(join(d, "project.yaml"))) continue;
    const where = `project ${id}`;
    const parsed = ProjectMeta.safeParse(readYaml(join(d, "project.yaml")));
    if (!parsed.success) throw new Error(`${where}: invalid project.yaml\n${parsed.error.message}`);
    const meta = parsed.data;
    if (meta.id !== id) throw new Error(`${where}: id in yaml must match folder name`);
    for (const s of meta.prerequisites) if (!skills.has(s)) throw new Error(`${where}: unknown prerequisite skill ${s}`);

    const decisions = new Map<string, Decision>();
    const decDir = join(d, "decisions");
    for (const file of existsSync(decDir) ? readdirSync(decDir).filter((f) => f.endsWith(".yaml")).sort() : []) {
      const dec = Decision.safeParse(readYaml(join(decDir, file)));
      if (!dec.success) throw new Error(`${where}: invalid decisions/${file}\n${dec.error.message}`);
      if (`${dec.data.id}.yaml` !== file) throw new Error(`${where}: decisions/${file} must be named after its id`);
      const criteria = new Set(dec.data.criteria.map((c) => c.id));
      for (const o of dec.data.options) {
        for (const c of criteria) if (!(c in o.fit)) throw new Error(`${where}: decision ${dec.data.id}, option ${o.id} has no fit for ${c}`);
        for (const c of Object.keys(o.fit)) if (!criteria.has(c)) throw new Error(`${where}: decision ${dec.data.id}, option ${o.id} rates unknown criterion ${c}`);
        for (const s of o.relatedSkills) if (!skills.has(s)) throw new Error(`${where}: decision ${dec.data.id}, option ${o.id}: unknown skill ${s}`);
      }
      decisions.set(dec.data.id, dec.data);
    }

    const steps = new Map<string, LoadedStep>();
    const stepsDir = join(d, "steps");
    for (const sid of subdirs(stepsDir)) {
      const sd = join(stepsDir, sid);
      const st = ProjectStep.safeParse(readYaml(join(sd, "step.yaml")));
      if (!st.success) throw new Error(`${where}: invalid steps/${sid}/step.yaml\n${st.error.message}`);
      if (st.data.id !== sid) throw new Error(`${where}: step id in yaml must match folder name (${sid})`);
      for (const s of st.data.skills) if (!skills.has(s)) throw new Error(`${where}: step ${sid}: unknown skill ${s}`);
      for (const dep of st.data.dependsOn) if (!decisions.has(dep)) throw new Error(`${where}: step ${sid} depends on unknown decision ${dep}`);
      const optionIds = new Set(st.data.dependsOn.flatMap((dep) => decisions.get(dep)!.options.map((o) => o.id)));
      for (const v of Object.keys(st.data.variants)) {
        if (!optionIds.has(v)) throw new Error(`${where}: step ${sid} has notes for ${v}, which isn't an option of its dependsOn decisions`);
      }
      const refDir = join(sd, "reference");
      steps.set(sid, {
        meta: st.data,
        dir: sd,
        acceptanceTests: readFileSync(join(sd, "acceptance.test.js"), "utf8"),
        references: new Map(subdirs(refDir).map((k) => [k, join(refDir, k)])),
        wrong: subdirs(join(sd, "wrong")).map((name) => ({ name, dir: join(sd, "wrong", name) })),
      });
    }

    const order: LoadedProject["order"] = [];
    const seen = new Set<string>();
    for (const m of meta.milestones) {
      for (const item of m.items) {
        if ("step" in item) {
          const step = steps.get(item.step);
          if (!step) throw new Error(`${where}: milestone ${m.id} lists unknown step ${item.step}`);
          for (const dep of step.meta.dependsOn) {
            if (!seen.has(`decision:${dep}`)) throw new Error(`${where}: step ${item.step} depends on decision ${dep}, which must come before it`);
          }
          order.push({ kind: "step", id: item.step });
        } else if ("decision" in item) {
          if (!decisions.has(item.decision)) throw new Error(`${where}: milestone ${m.id} lists unknown decision ${item.decision}`);
          order.push({ kind: "decision", id: item.decision });
        } else {
          order.push({ kind: "checkpoint", prompt: item.checkpoint });
          continue;
        }
        const key = "step" in item ? `step:${item.step}` : `decision:${item.decision}`;
        if (seen.has(key)) throw new Error(`${where}: ${key} appears twice`);
        seen.add(key);
      }
    }
    for (const sid of steps.keys()) if (!seen.has(`step:${sid}`)) throw new Error(`${where}: step ${sid} isn't in any milestone`);
    projects.set(id, { meta, dir: d, decisions, steps, order });
  }
  return projects;
}
