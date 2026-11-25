import { test } from "node:test";
import assert from "node:assert/strict";
import { countAtLeast } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("every value is large enough", () => assert.equal(countAtLeast([10, 20, 30], 1), 3));
test("an empty list has none", () => assert.equal(countAtLeast([], 5), 0));
test("a one-value list, large enough", () => assert.equal(countAtLeast([7], 7), 1));
test("a one-value list, too small", () => assert.equal(countAtLeast([7], 8), 0));
test("a limit just above the largest value", () => assert.equal(countAtLeast([1, 2, 3, 4], 5), 0));
test("a limit equal to the largest value", () => assert.equal(countAtLeast([1, 2, 3, 4], 4), 1));
test("a limit equal to the smallest value", () => assert.equal(countAtLeast([1, 2, 3, 4], 1), 4));
test("many repeated values at the limit", () => assert.equal(countAtLeast([5, 5, 5, 5, 5, 9], 5), 6));
test("many repeated values just under the limit", () => assert.equal(countAtLeast([5, 5, 5, 5, 5, 9], 6), 1));
test("does not change the list", () => {
  const times = Object.freeze([10, 20, 30]);
  assert.equal(countAtLeast(times, 15), 2);
});
test("20,000 calls on 200,000 times are answered quickly", () => {
  const times = Array.from({ length: 200000 }, (_, i) => i);
  let total = 0;
  quick(() => {
    for (let q = 0; q < 20000; q++) total += countAtLeast(times, q * 10);
  }, 300);
  let expected = 0;
  for (let q = 0; q < 20000; q++) expected += 200000 - q * 10;
  assert.equal(total, expected);
});
