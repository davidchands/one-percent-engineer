import { test } from "node:test";
import assert from "node:assert/strict";
import { cartTotal } from "./solution.js";

test("a single item", () => assert.equal(cartTotal([350]), 350));
test("the first item is counted", () => assert.equal(cartTotal([1000, 1, 1]), 1002));
test("the last item is counted", () => assert.equal(cartTotal([1, 1, 1000]), 1002));
test("many items", () => assert.equal(cartTotal(Array.from({ length: 50 }, () => 100)), 5000));
test("does not change the cart", () => {
  const cart = Object.freeze([100, 200]);
  assert.doesNotThrow(() => cartTotal(cart));
});
