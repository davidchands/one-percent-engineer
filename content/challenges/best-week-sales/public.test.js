import { test } from "node:test";
import assert from "node:assert/strict";
import { bestStretch } from "./solution.js";

test("finds the best three days", () => assert.equal(bestStretch([1, 2, 3, 10, 1, 1], 3), 15));
test("a window of one day is the best single day", () => assert.equal(bestStretch([4, 9, 2], 1), 9));
test("a window as long as the list is the total", () => assert.equal(bestStretch([1, 2, 3], 3), 6));
