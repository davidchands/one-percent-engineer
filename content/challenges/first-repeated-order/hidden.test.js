import { test } from "node:test";
import assert from "node:assert/strict";
import { firstRepeat } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("the earliest SECOND scan wins", () => assert.equal(firstRepeat(["A1", "B2", "B2", "A1"]), "B2"));
test("a repeat right after the first scan", () => assert.equal(firstRepeat(["A1", "A1"]), "A1"));
test("a repeat at the very end", () => assert.equal(firstRepeat(["A", "B", "C", "D", "A"]), "A"));
test("an empty list has no repeat", () => assert.equal(firstRepeat([]), null));
test("a single scan has no repeat", () => assert.equal(firstRepeat(["A1"]), null));
test("numbers that look alike are different", () => assert.equal(firstRepeat(["A1", "A10", "A01", "a1"]), null));
test("a third scan does not change the answer", () => assert.equal(firstRepeat(["X", "Y", "Y", "X", "X"]), "Y"));
test("does not change the list", () => {
  const scans = Object.freeze(["B", "A", "B"]);
  assert.equal(firstRepeat(scans), "B");
  assert.deepEqual([...scans], ["B", "A", "B"]);
});
test("60,000 different scans are checked quickly", () => {
  const scans = Array.from({ length: 60000 }, (_, i) => "ORD-" + i);
  assert.equal(quick(() => firstRepeat(scans), 400), null);
});
test("a repeat at the end of 60,000 scans is found quickly", () => {
  const scans = Array.from({ length: 60000 }, (_, i) => "ORD-" + i);
  scans.push("ORD-0");
  assert.equal(quick(() => firstRepeat(scans), 400), "ORD-0");
});
