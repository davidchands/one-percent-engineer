import { test } from "node:test";
import assert from "node:assert/strict";
import { fewestTransfers } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("a loop does not trap the search", () => {
  const routes = { A: ["B"], B: ["A", "C"], C: [] };
  assert.equal(fewestTransfers(routes, "A", "C"), 2);
});
test("a loop with no way out ends with -1", () => {
  const routes = { A: ["B"], B: ["A"] };
  assert.equal(fewestTransfers(routes, "A", "Z"), -1);
});
test("stops missing from the object have no connections", () => {
  assert.equal(fewestTransfers({ A: ["B"] }, "A", "B"), 1);
  assert.equal(fewestTransfers({ A: ["B"] }, "B", "C"), -1);
});
test("an unknown destination is -1", () => assert.equal(fewestTransfers({ A: ["B"] }, "A", "Q"), -1));
test("connections go one way only", () => {
  const routes = { A: ["B"], B: ["C"] };
  assert.equal(fewestTransfers(routes, "A", "C"), 2);
  assert.equal(fewestTransfers(routes, "C", "A"), -1);
});
test("the shortest of several routes is chosen", () => {
  const routes = { S: ["A", "B"], A: ["C"], B: ["D"], C: ["E"], D: ["T"], E: ["T"] };
  assert.equal(fewestTransfers(routes, "S", "T"), 3);
});
test("the route found first by depth is not always the shortest", () => {
  const routes = { A: ["B", "D"], B: ["C"], C: ["E"], D: ["E"] };
  assert.equal(fewestTransfers(routes, "A", "E"), 2);
});
test("does not change the routes", () => {
  const routes = Object.freeze({ A: Object.freeze(["B"]), B: Object.freeze([]) });
  assert.equal(fewestTransfers(routes, "A", "B"), 1);
});
test("a chain of 60,000 stops is searched quickly", () => {
  const routes = {};
  for (let i = 0; i < 60000; i++) routes["s" + i] = ["s" + (i + 1)];
  assert.equal(quick(() => fewestTransfers(routes, "s0", "s60000"), 500), 60000);
});
test("a chain of 60,000 stops with no route is searched quickly", () => {
  const routes = {};
  for (let i = 0; i < 60000; i++) routes["s" + i] = ["s" + (i + 1)];
  assert.equal(quick(() => fewestTransfers(routes, "s0", "nowhere"), 500), -1);
});
