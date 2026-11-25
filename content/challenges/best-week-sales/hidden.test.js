import { test } from "node:test";
import assert from "node:assert/strict";
import { bestStretch } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("all negative: the least negative window wins", () => assert.equal(bestStretch([-5, -2, -9], 2), -7));
test("the best window can be the first one", () => assert.equal(bestStretch([9, 9, 1, 1, 1], 2), 18));
test("the best window can be the last one", () => assert.equal(bestStretch([1, 1, 1, 9, 9], 2), 18));
test("a refund day inside the best window still counts", () => assert.equal(bestStretch([5, -3, 8, 1], 3), 10));
test("one day, one window", () => assert.equal(bestStretch([4], 1), 4));
test("days longer than the list is a RangeError", () => assert.throws(() => bestStretch([1, 2], 3), RangeError));
test("zero days is a RangeError", () => assert.throws(() => bestStretch([1, 2], 0), RangeError));
test("a fractional window is a RangeError", () => assert.throws(() => bestStretch([1, 2, 3], 1.5), RangeError));
test("does not change the list", () => {
  const takings = Object.freeze([1, 2, 3, 10, 1, 1]);
  assert.equal(bestStretch(takings, 3), 15);
});
test("500,000 days with a window of 250,000 are handled quickly", () => {
  const takings = Array.from({ length: 500000 }, (_, i) => (i % 7) - 3);
  const result = quick(() => bestStretch(takings, 250000), 300);
  assert.equal(typeof result, "number");
  assert.ok(Number.isFinite(result));
});
test("the quick answer is also the right answer on a big list", () => {
  const takings = new Array(400000).fill(1);
  takings[399999] = 5;
  assert.equal(quick(() => bestStretch(takings, 200000), 300), 200004);
});
