/**
 * Loads content-as-code from /content:
 *   content/skills/*.yaml                 → skill graph
 *   content/challenges/<id>/challenge.yaml → metadata (validated by Zod)
 *   content/challenges/<id>/starter.mjs   → what you start with
 *   content/challenges/<id>/public.test.mjs → tests you can see
 *   content/challenges/<id>/hidden.test.mjs → tests you can't see (edge cases)
 *   content/challenges/<id>/solution.mjs  → reference solution, never sent unless requested
 *   content/challenges/<id>/wrong/*.mjs   → plausible wrong solutions; validation proves the tests catch them
 *
 * Invalid content fails loudly at startup instead of half-working.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { ChallengeMeta, SkillNode } from "@1pe/contracts";

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
    const read = (f: string) => readFileSync(join(d, f), "utf8");
    const wrongDir = join(d, "wrong");
    challenges.set(id, {
      meta: parsed.data,
      context: typeof raw.context === "string" ? raw.context : "general",
      dir: d,
      starter: read("starter.mjs"),
      publicTests: read("public.test.mjs"),
      hiddenTests: read("hidden.test.mjs"),
      solution: read("solution.mjs"),
      wrongSolutions: existsSync(wrongDir)
        ? readdirSync(wrongDir)
            .filter((f) => f.endsWith(".mjs"))
            .map((f) => ({ name: f, code: readFileSync(join(wrongDir, f), "utf8") }))
        : [],
    });
  }
  return { skills, challenges };
}
