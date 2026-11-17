import { test } from "node:test";
import assert from "node:assert/strict";
import { ticketPrice } from "./solution.js";

test("a child pays 5", () => assert.equal(ticketPrice(8), 5));
test("an adult pays 12", () => assert.equal(ticketPrice(30), 12));
test("a senior pays 7", () => assert.equal(ticketPrice(70), 7));
