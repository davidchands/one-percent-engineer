import { test } from "node:test";
import assert from "node:assert/strict";
import { countVowels } from "./solution.js";

test("counts vowels in a simple phrase", () => assert.equal(countVowels("hello world"), 3));
test("empty text has no vowels", () => assert.equal(countVowels(""), 0));
