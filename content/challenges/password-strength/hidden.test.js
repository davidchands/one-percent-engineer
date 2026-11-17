import { test } from "node:test";
import assert from "node:assert/strict";
import { isStrongPassword } from "./solution.js";

test("exactly 8 characters is long enough", () => assert.equal(isStrongPassword("Abcdefg1"), true));
test("7 characters is too short", () => assert.equal(isStrongPassword("Abcdef1"), false));
test("no digit is not strong", () => assert.equal(isStrongPassword("SunshineDay"), false));
test("digit at the very end still counts", () => assert.equal(isStrongPassword("Sunshinee9"), true));
test("capital at the very end still counts", () => assert.equal(isStrongPassword("1sunshineZ"), true));
test("a long all-lower-case password is not strong", () => assert.equal(isStrongPassword("correcthorsebatterystaple"), false));
test("returns a real boolean", () => assert.equal(typeof isStrongPassword("x"), "boolean"));
