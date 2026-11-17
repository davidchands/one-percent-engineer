import { test } from "node:test";
import assert from "node:assert/strict";
import { ticketPrice } from "./solution.js";

test("boundary: 11 is still a child", () => assert.equal(ticketPrice(11), 5));
test("boundary: 12 is not a child", () => assert.equal(ticketPrice(12), 12));
test("boundary: 64 is not a senior", () => assert.equal(ticketPrice(64), 12));
test("boundary: 65 is a senior", () => assert.equal(ticketPrice(65), 7));
test("a newborn (0) is a child", () => assert.equal(ticketPrice(0), 5));
test("a negative age is impossible: null", () => assert.equal(ticketPrice(-1), null));
