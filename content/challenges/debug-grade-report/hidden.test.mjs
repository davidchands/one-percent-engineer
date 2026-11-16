import { test } from "node:test";
import assert from "node:assert/strict";
import { averageGrade, topStudent } from "./solution.mjs";

test("empty grade list has no average (null)", () => assert.equal(averageGrade([]), null));
test("rounds to one decimal place", () => assert.equal(averageGrade([84, 84.5]), 84.3));
test("keeps decimals in numeric strings", () => assert.equal(averageGrade(["90.5"]), 90.5));
test("rejects non-numeric grades with the index in the message", () => {
  assert.throws(() => averageGrade([80, "absent", 90]), (err) => err instanceof TypeError && /1/.test(err.message));
});
test("ties go to the alphabetically first name, whatever the input order", () => {
  assert.equal(topStudent([{ name: "Zola", grades: [90] }, { name: "Amani", grades: [90] }]), "Amani");
  assert.equal(topStudent([{ name: "Amani", grades: [90] }, { name: "Zola", grades: [90] }]), "Amani");
});
test("students without grades are skipped", () => {
  assert.equal(topStudent([{ name: "Baraka", grades: [] }, { name: "Chiku", grades: [10] }]), "Chiku");
});
test("no graded students means no top student", () => {
  assert.equal(topStudent([{ name: "Baraka", grades: [] }]), null);
  assert.equal(topStudent([]), null);
});
