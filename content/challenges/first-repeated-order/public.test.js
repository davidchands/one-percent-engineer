import { test } from "node:test";
import assert from "node:assert/strict";
import { firstRepeat } from "./solution.js";

test("finds a repeated scan", () => assert.equal(firstRepeat(["A1", "B2", "A1"]), "A1"));
test("returns null when nothing repeats", () => assert.equal(firstRepeat(["A1", "B2"]), null));
