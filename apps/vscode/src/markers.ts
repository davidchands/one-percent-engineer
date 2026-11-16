/**
 * The task comment: a clearly marked block describing today's challenge, placed in a file
 * ONLY when you explicitly ask for it.
 *
 *   /* <1pe:task id="printing-cost">
 *    * ...
 *    * </1pe:task> *\/
 *
 * Rules:
 *  - Running the command again REPLACES the existing block. It never stacks a second copy.
 *  - Everything outside the markers is left byte-for-byte untouched.
 *  - Content can never close the comment early (a `*\/` inside a requirement is escaped).
 */
import type { ChallengePublic } from "@1pe/contracts";

const OPEN_RE = /\/\* <1pe:task id="[^"]*">/;
const CLOSE = "</1pe:task> */";

export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para.trim() === "") {
      out.push("");
      continue;
    }
    const indent = /^\s*/.exec(para)![0];
    let line = "";
    for (const word of para.trim().split(/\s+/)) {
      if (line && (indent + line + " " + word).length > width) {
        out.push(indent + line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) out.push(indent + line);
  }
  return out;
}

const safe = (s: string) => s.replace(/\*\//g, "*\\/");

export function renderTaskComment(ch: Pick<ChallengePublic, "id" | "title" | "objective" | "problem" | "requirements" | "constraints" | "beforeCoding">): string {
  const W = 74;
  const lines: string[] = [
    "1% ENGINEER — DAILY CHALLENGE",
    `${ch.title}`,
    "",
    ...wrap(`Objective: ${ch.objective}`, W),
    "",
    "Problem:",
    ...wrap(ch.problem.trim(), W).map((l) => (l ? `  ${l}` : "")),
    "",
    "Requirements:",
    ...ch.requirements.flatMap((r, i) => wrap(`${i + 1}. ${r}`, W - 2).map((l, j) => (j ? `     ${l}` : `  ${l}`))),
    "",
    "Constraints:",
    ...ch.constraints.flatMap((c) => wrap(`- ${c}`, W - 2).map((l, j) => (j ? `    ${l}` : `  ${l}`))),
    "",
    "Before coding:",
    ...ch.beforeCoding.flatMap((b) => wrap(`- ${b}`, W - 2).map((l, j) => (j ? `    ${l}` : `  ${l}`))),
    "",
    "Don't look for a complete solution.",
  ];
  const body = lines.map((l) => (l ? ` * ${safe(l)}` : " *")).join("\n");
  return `/* <1pe:task id="${ch.id}">\n${body}\n * ${CLOSE}`;
}

export interface Placement {
  text: string;
  /** "inserted" at the top, or "replaced" an existing block. */
  action: "inserted" | "replaced";
  /** Character offsets of the region that changed in the ORIGINAL text. */
  start: number;
  end: number;
  replacement: string;
}

/** Computes where the block goes. Pure: returns the edit, doesn't apply it. */
export function placeTaskComment(original: string, block: string): Placement {
  const open = OPEN_RE.exec(original);
  if (open) {
    const closeAt = original.indexOf(CLOSE, open.index);
    if (closeAt !== -1) {
      const start = open.index;
      const end = closeAt + CLOSE.length;
      return { text: original.slice(0, start) + block + original.slice(end), action: "replaced", start, end, replacement: block };
    }
  }
  // Insert at the top, but after a shebang line if the file has one.
  const shebang = original.startsWith("#!") ? original.indexOf("\n") + 1 || original.length : 0;
  const replacement = `${block}\n\n`;
  return {
    text: original.slice(0, shebang) + replacement + original.slice(shebang),
    action: "inserted",
    start: shebang,
    end: shebang,
    replacement,
  };
}

/** Starter files come with their own header comment; drop it so the task block isn't duplicated. */
export function stripLeadingComment(code: string): string {
  const m = /^\s*\/\*[\s\S]*?\*\/\s*/.exec(code);
  return m ? code.slice(m[0].length) : code;
}
