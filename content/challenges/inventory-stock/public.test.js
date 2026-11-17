import { test } from "node:test";
import assert from "node:assert/strict";
import { createInventory } from "./solution.js";

test("unknown SKUs have zero stock", () => assert.equal(createInventory().quantity("mug"), 0));
test("add then remove updates stock", () => {
  const inv = createInventory();
  inv.add("mug", 3);
  inv.remove("mug", 2);
  assert.equal(inv.quantity("mug"), 1);
});
test("removing more than in stock throws and leaves stock unchanged", () => {
  const inv = createInventory();
  inv.add("mug", 1);
  assert.throws(() => inv.remove("mug", 2));
  assert.equal(inv.quantity("mug"), 1);
});
test("removeMany removes every line", () => {
  const inv = createInventory();
  inv.add("mug", 2);
  inv.add("pen", 5);
  inv.removeMany([{ sku: "mug", qty: 1 }, { sku: "pen", qty: 5 }]);
  assert.deepEqual(inv.snapshot(), { mug: 1, pen: 0 });
});
