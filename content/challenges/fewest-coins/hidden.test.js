import { test } from "node:test";
import assert from "node:assert/strict";
import { fewestCoins } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

test("an amount of 0 needs no coins", () => assert.equal(fewestCoins([1, 2], 0), 0));
test("an amount equal to a coin needs one coin", () => assert.equal(fewestCoins([2, 7], 7), 1));
test("coins given in any order give the same answer", () => assert.equal(fewestCoins([4, 1, 3], 6), 2));
test("no coins at all cannot make a positive amount", () => assert.equal(fewestCoins([], 5), -1));
test("an amount smaller than every coin is -1", () => assert.equal(fewestCoins([5, 10], 4), -1));
test("a single coin that divides the amount", () => assert.equal(fewestCoins([7], 21), 3));
test("a single coin that does not divide the amount", () => assert.equal(fewestCoins([7], 20), -1));
test("an awkward set where greedy fails", () => assert.equal(fewestCoins([1, 15, 25], 30), 2));
test("does not change the coins", () => {
  const coins = Object.freeze([1, 3, 4]);
  assert.equal(fewestCoins(coins, 6), 2);
});
test("an amount of 100,000 with six coins is solved quickly", () => {
  assert.equal(quick(() => fewestCoins([1, 2, 5, 10, 20, 50], 100000), 400), 2000);
});
test("a big amount that cannot be made is solved quickly", () => {
  assert.equal(quick(() => fewestCoins([6, 10, 14], 99999), 400), -1);
});
test("a big amount that needs many different coins is right", () => {
  assert.equal(quick(() => fewestCoins([9, 6, 5, 1], 11), 400), 2);
});
