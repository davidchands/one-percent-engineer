import { test } from "node:test";
import assert from "node:assert/strict";
import { averageGrade, topStudent } from "./solution.mjs";

test("averages numeric grades", () => assert.equal(averageGrade([80, 90]), 85));
test("accepts numeric strings from CSV", () => assert.equal(averageGrade(["85.5", 90]), 87.8));
test("finds the top student", () => {
  assert.equal(topStudent([{ name: "Amani", grades: [70, 80] }, { name: "Zola", grades: [95] }]), "Zola");
});
