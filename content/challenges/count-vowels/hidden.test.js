import { test } from "node:test";
import assert from "node:assert/strict";
import { countVowels } from "./solution.js";

test("capital letters count", () => assert.equal(countVowels("APPLE"), 2));
test("mixed case", () => assert.equal(countVowels("JavaScript Is Fun"), 5));
test("y is not a vowel", () => assert.equal(countVowels("rhythm"), 0));
test("punctuation and numbers are ignored", () => assert.equal(countVowels("A1, b2; e3!"), 2));
test("every vowel once", () => assert.equal(countVowels("aEiOu"), 5));
