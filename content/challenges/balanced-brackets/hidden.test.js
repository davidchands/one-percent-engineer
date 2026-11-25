import { test } from "node:test";
import assert from "node:assert/strict";
import { isBalanced } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("an empty formula is balanced", () => assert.equal(isBalanced(""), true));
test("text with no brackets is balanced", () => assert.equal(isBalanced("A1 + B2"), true));
test("a closing bracket first is not balanced", () => assert.equal(isBalanced(")("), false));
test("a lone closing bracket is not balanced", () => assert.equal(isBalanced("a)"), false));
test("a mismatched pair is not balanced", () => assert.equal(isBalanced("(]"), false));
test("a bracket left open at the end is not balanced", () => assert.equal(isBalanced("{[()]"), false));
test("side-by-side groups are balanced", () => assert.equal(isBalanced("()[]{}"), true));
test("deep nesting is balanced", () => assert.equal(isBalanced("{[(((())))]}"), true));
test("200,000 nested brackets are checked quickly", () => {
  const formula = "(".repeat(100000) + ")".repeat(100000);
  assert.equal(quick(() => isBalanced(formula), 400), true);
});
test("200,000 brackets with one mistake at the end are checked quickly", () => {
  const formula = "(".repeat(100000) + ")".repeat(99999) + "]";
  assert.equal(quick(() => isBalanced(formula), 400), false);
});
