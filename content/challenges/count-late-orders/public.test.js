import { test } from "node:test";
import assert from "node:assert/strict";
import { countAtLeast } from "./solution.js";

test("counts the larger values", () => assert.equal(countAtLeast([10, 20, 30, 40], 25), 2));
test("values equal to the limit count", () => assert.equal(countAtLeast([10, 20, 20, 30], 20), 3));
test("nothing is large enough", () => assert.equal(countAtLeast([10, 20], 99), 0));
