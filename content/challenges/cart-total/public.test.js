import { test } from "node:test";
import assert from "node:assert/strict";
import { cartTotal } from "./solution.js";

test("adds up three prices", () => assert.equal(cartTotal([499, 250, 1000]), 1749));
test("an empty cart costs 0", () => assert.equal(cartTotal([]), 0));
