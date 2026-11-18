import { test } from "node:test";
import assert from "node:assert/strict";
import { canBorrow } from "./solution.js";

test("exactly 5 books out is not allowed", () => assert.equal(canBorrow(true, 5, false), false));
test("4 books out is still allowed", () => assert.equal(canBorrow(true, 4, false), true));
test("no books out with an active card is allowed", () => assert.equal(canBorrow(true, 0, false), true));
test("an inactive card with too many books can't borrow", () => assert.equal(canBorrow(false, 7, false), false));
test("an inactive card isn't rescued by having few books", () => assert.equal(canBorrow(false, 1, false), false));
test("staff with an active card and many books can borrow", () => assert.equal(canBorrow(true, 12, true), true));
test("staff with exactly 5 books can borrow", () => assert.equal(canBorrow(false, 5, true), true));
