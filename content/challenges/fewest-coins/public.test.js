import { test } from "node:test";
import assert from "node:assert/strict";
import { fewestCoins } from "./solution.js";

test("makes change with ordinary coins", () => assert.equal(fewestCoins([1, 5, 10], 28), 6));
test("the biggest coin first is not always best", () => assert.equal(fewestCoins([1, 3, 4], 6), 2));
test("an impossible amount is -1", () => assert.equal(fewestCoins([5, 10], 3), -1));
