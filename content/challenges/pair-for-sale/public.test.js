import { test } from "node:test";
import assert from "node:assert/strict";
import { findPricePair } from "./solution.js";

test("finds a pair", () => assert.deepEqual(findPricePair([1, 3, 4, 8, 9], 12), [3, 9]));
test("two books can cost the same", () => assert.deepEqual(findPricePair([2, 5, 5, 9], 10), [5, 5]));
test("returns null when nothing matches", () => assert.equal(findPricePair([1, 2, 3], 100), null));
