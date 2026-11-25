import { test } from "node:test";
import assert from "node:assert/strict";
import { findPair } from "./solution.js";

test("finds the pair in a small list", () => assert.deepEqual(findPair([2, 7, 11, 15], 9), [0, 1]));
test("returns null when no pair works", () => assert.equal(findPair([1, 2, 3], 100), null));
test("one item cannot be used twice", () => assert.equal(findPair([5, 3], 10), null));
