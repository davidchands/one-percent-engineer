import { test } from "node:test";
import assert from "node:assert/strict";
import { createInventory } from "./solution.js";

test("removeMany is all-or-nothing when a later line fails", () => {
  const inv = createInventory();
  inv.add("mug", 2);
  inv.add("pen", 1);
  assert.throws(() => inv.removeMany([{ sku: "mug", qty: 2 }, { sku: "pen", qty: 5 }]));
  assert.deepEqual(inv.snapshot(), { mug: 2, pen: 1 });
});
test("removeMany checks repeated SKUs together", () => {
  const inv = createInventory();
  inv.add("mug", 5);
  assert.throws(() => inv.removeMany([{ sku: "mug", qty: 3 }, { sku: "mug", qty: 3 }]));
  assert.equal(inv.quantity("mug"), 5);
});
test("inventories are independent", () => {
  const a = createInventory();
  const b = createInventory();
  a.add("mug", 3);
  assert.equal(b.quantity("mug"), 0);
});
test("snapshot is a copy, not a window into the state", () => {
  const inv = createInventory();
  inv.add("mug", 3);
  const snap = inv.snapshot();
  snap.mug = -100;
  assert.equal(inv.quantity("mug"), 3);
});
test("invalid quantities throw RangeError", () => {
  const inv = createInventory();
  assert.throws(() => inv.add("mug", 0), RangeError);
  assert.throws(() => inv.add("mug", -2), RangeError);
  assert.throws(() => inv.add("mug", 1.5), RangeError);
  assert.throws(() => inv.remove("mug", 0), RangeError);
});
test("invalid SKUs throw TypeError", () => {
  const inv = createInventory();
  assert.throws(() => inv.add("", 1), TypeError);
  assert.throws(() => inv.add(42, 1), TypeError);
});
test("invalid lines in removeMany are rejected before anything changes", () => {
  const inv = createInventory();
  inv.add("mug", 2);
  assert.throws(() => inv.removeMany([{ sku: "mug", qty: 1 }, { sku: "pen", qty: -1 }]));
  assert.equal(inv.quantity("mug"), 2);
});
test("error messages name the SKU", () => {
  const inv = createInventory();
  assert.throws(() => inv.remove("blue-mug", 1), /blue-mug/);
});
