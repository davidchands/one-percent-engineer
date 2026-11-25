import { test } from "node:test";
import assert from "node:assert/strict";
import { fewestTransfers } from "./solution.js";

test("finds the shorter of two routes", () => {
  const routes = { A: ["B", "D"], B: ["C"], C: ["E"], D: ["E"] };
  assert.equal(fewestTransfers(routes, "A", "E"), 2);
});
test("returns 0 for the same stop", () => assert.equal(fewestTransfers({}, "A", "A"), 0));
test("returns -1 when there is no route", () => assert.equal(fewestTransfers({ A: ["B"] }, "B", "A"), -1));
