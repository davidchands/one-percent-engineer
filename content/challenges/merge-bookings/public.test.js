import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeBookings } from "./solution.js";

test("merges overlapping bookings", () => assert.deepEqual(mergeBookings([[1, 3], [2, 6], [8, 10]]), [[1, 6], [8, 10]]));
test("bookings that touch are merged", () => assert.deepEqual(mergeBookings([[5, 8], [1, 5]]), [[1, 8]]));
test("an empty list gives an empty list", () => assert.deepEqual(mergeBookings([]), []));
