import { test } from "node:test";
import assert from "node:assert/strict";
import { canBorrow } from "./solution.js";

test("an active member with 2 books can borrow", () => assert.equal(canBorrow(true, 2, false), true));
test("an inactive card can't borrow", () => assert.equal(canBorrow(false, 0, false), false));
test("staff can always borrow", () => assert.equal(canBorrow(false, 9, true), true));
