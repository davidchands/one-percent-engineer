import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeBookings } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("a booking inside another disappears into it", () => assert.deepEqual(mergeBookings([[1, 10], [2, 3]]), [[1, 10]]));
test("bookings arriving out of order are sorted", () => assert.deepEqual(mergeBookings([[8, 10], [1, 3], [2, 6]]), [[1, 6], [8, 10]]));
test("separate bookings stay separate", () => assert.deepEqual(mergeBookings([[1, 2], [4, 5], [7, 8]]), [[1, 2], [4, 5], [7, 8]]));
test("one booking is returned as it is", () => assert.deepEqual(mergeBookings([[3, 9]]), [[3, 9]]));
test("a chain of overlaps becomes one block", () => assert.deepEqual(mergeBookings([[1, 4], [3, 6], [5, 8], [7, 12]]), [[1, 12]]));
test("numbers are sorted as numbers, not as text", () => assert.deepEqual(mergeBookings([[100, 120], [9, 20]]), [[9, 20], [100, 120]]));
test("a later booking inside a block does not shrink it", () => assert.deepEqual(mergeBookings([[1, 20], [2, 5], [6, 8]]), [[1, 20]]));
test("does not change the list or the pairs", () => {
  const bookings = [[5, 8], [1, 5]];
  const copy = JSON.stringify(bookings);
  mergeBookings(bookings);
  assert.equal(JSON.stringify(bookings), copy);
});
test("works on a frozen list", () => {
  const bookings = Object.freeze([Object.freeze([2, 4]), Object.freeze([1, 3])]);
  assert.deepEqual(mergeBookings(bookings), [[1, 4]]);
});
test("200,000 bookings are merged quickly", () => {
  const bookings = Array.from({ length: 200000 }, (_, i) => [(199999 - i) * 10, (199999 - i) * 10 + 5]);
  const merged = quick(() => mergeBookings(bookings), 500);
  assert.equal(merged.length, 200000);
  assert.deepEqual(merged[0], [0, 5]);
});
