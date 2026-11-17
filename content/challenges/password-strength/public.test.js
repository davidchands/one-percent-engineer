import { test } from "node:test";
import assert from "node:assert/strict";
import { isStrongPassword } from "./solution.js";

test("a strong password", () => assert.equal(isStrongPassword("Sunshine42"), true));
test("no upper-case letter is not strong", () => assert.equal(isStrongPassword("sunshine42"), false));
test("too short is not strong", () => assert.equal(isStrongPassword("Sun4"), false));
