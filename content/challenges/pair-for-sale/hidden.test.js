import { test } from "node:test";
import assert from "node:assert/strict";
import { findPricePair } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("one book cannot be paired with itself", () => assert.equal(findPricePair([5, 9], 10), null));
test("an empty list has no pair", () => assert.equal(findPricePair([], 10), null));
test("one book has no pair", () => assert.equal(findPricePair([5], 10), null));
test("the pair with the lowest low price is returned", () => assert.deepEqual(findPricePair([1, 2, 3, 4, 5, 6, 7, 8, 9], 10), [1, 9]));
test("the cheapest and dearest can be the pair", () => assert.deepEqual(findPricePair([2, 3, 4, 8], 10), [2, 8]));
test("a pair in the middle of the list is found", () => assert.deepEqual(findPricePair([1, 2, 4, 6, 11, 12], 10), [4, 6]));
test("the two dearest books can be the pair", () => assert.deepEqual(findPricePair([1, 2, 7, 8], 15), [7, 8]));
test("the two cheapest books can be the pair", () => assert.deepEqual(findPricePair([1, 2, 7, 8], 3), [1, 2]));
test("returns null, not undefined, when nothing matches", () => assert.strictEqual(findPricePair([1, 2, 4], 8), null));
test("does not change the list", () => {
  const prices = Object.freeze([1, 3, 4, 8, 9]);
  assert.deepEqual(findPricePair(prices, 12), [3, 9]);
});
test("500,000 prices are searched quickly when there is no pair", () => {
  const prices = Array.from({ length: 500000 }, (_, i) => i * 2);
  assert.equal(quick(() => findPricePair(prices, 1000001), 300), null);
});
test("500,000 prices are searched quickly when a pair exists", () => {
  const prices = Array.from({ length: 500000 }, (_, i) => i * 2);
  assert.deepEqual(quick(() => findPricePair(prices, 500000), 300), [0, 500000]);
});
