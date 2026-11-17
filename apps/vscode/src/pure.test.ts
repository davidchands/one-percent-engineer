import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { placeTaskComment, reflow, renderTaskComment, stripLeadingComment, wrap } from "./markers.ts";
import { challengeDir, challengeIdForFile, expandHome, isInside } from "./paths.ts";

const ch = {
  id: "printing-cost",
  title: "University printing cost calculator",
  objective: "Practise problem decomposition.",
  problem: "Compute the total.\nIn cents.",
  requirements: ["Return an integer */ even if tricky", "A very long requirement ".repeat(8).trim()],
  constraints: ["No floats."],
  beforeCoding: ["Write pseudocode."],
};

test("the task block is a single valid comment, even with */ in the content", () => {
  const block = renderTaskComment(ch);
  assert.ok(block.startsWith('/* <1pe:task id="printing-cost">'));
  assert.ok(block.endsWith("</1pe:task> */"));
  assert.equal(block.match(/\*\//g)?.length, 1, "only the final */ may close the comment");
  assert.doesNotThrow(() => new Function(block + "\nreturn 1;"), "block must parse as JavaScript");
});

test("inserting puts the block at the top and keeps the rest byte-for-byte", () => {
  const code = "export const x = 1;\n";
  const p = placeTaskComment(code, renderTaskComment(ch));
  assert.equal(p.action, "inserted");
  assert.ok(p.text.endsWith(code));
});

test("running it twice replaces instead of duplicating", () => {
  const code = "export const x = 1;\n";
  const once = placeTaskComment(code, renderTaskComment(ch)).text;
  const updated = renderTaskComment({ ...ch, objective: "A new objective." });
  const twice = placeTaskComment(once, updated);
  assert.equal(twice.action, "replaced");
  assert.equal(twice.text.match(/<1pe:task/g)?.length, 1);
  assert.match(twice.text, /A new objective/);
  assert.ok(twice.text.endsWith(code));
});

test("code before and after an existing block is preserved", () => {
  const before = "// my header\n";
  const after = "\nfunction mine() {}\n";
  const file = before + renderTaskComment(ch) + after;
  const p = placeTaskComment(file, renderTaskComment({ ...ch, title: "Changed" }));
  assert.ok(p.text.startsWith(before));
  assert.ok(p.text.endsWith(after));
});

test("a shebang line stays first", () => {
  const p = placeTaskComment("#!/usr/bin/env node\nconsole.log(1)\n", renderTaskComment(ch));
  assert.ok(p.text.startsWith("#!/usr/bin/env node\n/* <1pe:task"));
});

test("wrap respects the width and keeps blank lines", () => {
  const lines = wrap("one two three four five six seven\n\nnext", 12);
  assert.ok(lines.every((l) => l.length <= 12));
  assert.ok(lines.includes(""));
});

test("starter header comments are stripped before adding the task block", () => {
  assert.equal(stripLeadingComment("/*\n * header\n */\n\nexport function f() {}\n"), "export function f() {}\n");
  assert.equal(stripLeadingComment("export function f() {}\n"), "export function f() {}\n");
});

test("isInside rejects escapes and sibling-prefix folders", () => {
  assert.ok(isInside("/a/practice", "/a/practice/x/solution.js"));
  assert.ok(!isInside("/a/practice", "/a/practice/../secrets.txt"));
  assert.ok(!isInside("/a/practice", "/a/practice-other/x.js"));
  assert.ok(!isInside("/a/practice", "/a/practice"));
});

test("challenge ids must be safe folder names", () => {
  assert.throws(() => challengeDir("/root", "../etc"));
  assert.equal(challengeDir("/root", "printing-cost"), "/root/printing-cost");
});

test("files map back to their challenge id", () => {
  assert.equal(challengeIdForFile("/r", "/r/printing-cost/solution.js"), "printing-cost");
  assert.equal(challengeIdForFile("/r", "/r/notes.md"), null);
  assert.equal(challengeIdForFile("/r", "/elsewhere/solution.js"), null);
});

test("~ expands to the home folder", () => {
  assert.equal(expandHome("~/x"), `${homedir()}/x`);
});

test("reflow joins wrapped sentences but keeps indented lines", () => {
  const yaml = "Grades arrive as strings, so some\narrive like \"85.5\".\n\nThe intended behaviour:\n  averageGrade(grades)\n  topStudent(students)\n";
  assert.equal(reflow(yaml), 'Grades arrive as strings, so some arrive like "85.5".\n\nThe intended behaviour:\n  averageGrade(grades)\n  topStudent(students)');
});

test("the task comment no longer breaks sentences at the source line breaks", () => {
  const block = renderTaskComment({ ...ch, problem: "Grades arrive as strings, so some\narrive like 85.5." });
  assert.match(block, /so some arrive like 85\.5\./);
});
