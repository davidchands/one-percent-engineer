import { test } from "node:test";
import assert from "node:assert/strict";
import { findPair } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("two items with the same price can make a pair", () => assert.deepEqual(findPair([3, 9, 3], 6), [0, 2]));
test("the pair with the smallest second position wins", () => assert.deepEqual(findPair([2, 4, 6, 8], 10), [1, 2]));
test("the earliest first item wins when the second position is shared", () => assert.deepEqual(findPair([4, 4, 6], 10), [0, 2]));
test("the pair can be at the very start", () => assert.deepEqual(findPair([1, 9, 5, 5], 10), [0, 1]));
test("the pair can be at the very end", () => assert.deepEqual(findPair([1, 2, 3, 4, 5], 9), [3, 4]));
test("an empty list has no pair", () => assert.equal(findPair([], 10), null));
test("a single item has no pair", () => assert.equal(findPair([10], 10), null));
test("a budget of zero works with zero-priced items", () => assert.deepEqual(findPair([0, 5, 0], 0), [0, 2]));
test("does not change the list", () => {
  const prices = Object.freeze([2, 7, 11, 15]);
  assert.deepEqual(findPair(prices, 9), [0, 1]);
});
test("handles 60,000 prices quickly when no pair exists", () => {
  const prices = Array.from({ length: 60000 }, (_, i) => (i + 1) * 2);
  assert.equal(quick(() => findPair(prices, 7), 400), null);
});
test("handles 60,000 prices quickly when the pair is at the end", () => {
  const prices = Array.from({ length: 60000 }, (_, i) => (i + 1) * 2);
  assert.deepEqual(quick(() => findPair(prices, 119998 + 120000), 400), [59998, 59999]);
});
