import { test } from "node:test";
import assert from "node:assert/strict";
import { isBalanced } from "./solution.js";

test("nested brackets of all three kinds", () => assert.equal(isBalanced("(a + [b * {c}])"), true));
test("the wrong order is not balanced", () => assert.equal(isBalanced("([)]"), false));
test("an unclosed bracket is not balanced", () => assert.equal(isBalanced("(("), false));
