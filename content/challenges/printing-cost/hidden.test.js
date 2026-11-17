import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePrintingCost as cost } from "./solution.js";

const bw = (pages, doubleSided = false) => ({ pages, color: false, doubleSided });
const colour = (pages, doubleSided = false) => ({ pages, color: true, doubleSided });

test("the free allowance is shared across jobs", () => assert.equal(cost([bw(6), bw(6)]), 10));
test("the free allowance never applies to colour pages", () => assert.equal(cost([colour(2), bw(12)]), 60));
test("double-sided rounding: halves round up", () => assert.equal(cost([bw(15, true)]), 23));
test("no bulk discount exactly at the threshold", () => assert.equal(cost([colour(80)]), 2000));
test("bulk discount above the threshold", () => assert.equal(cost([colour(84)]), 1995));
test("bulk discount is rounded to a whole cent", () => assert.equal(cost([colour(85)]), 2019));
test("result is always an integer", () => {
  const r = cost([colour(7, true), bw(33, true), colour(90, true)]);
  assert.ok(Number.isInteger(r), `got ${r}`);
});
test("rejects zero or fractional pages with RangeError", () => {
  assert.throws(() => cost([bw(0)]), RangeError);
  assert.throws(() => cost([bw(2.5)]), RangeError);
});
test("rejects non-number pages with TypeError", () => {
  assert.throws(() => cost([{ pages: "10", color: false, doubleSided: false }]), TypeError);
});
test("does not mutate the input", () => {
  const jobs = Object.freeze([Object.freeze(bw(30)), Object.freeze(colour(3, true))]);
  assert.doesNotThrow(() => cost(jobs));
});
