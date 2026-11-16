import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePrintingCost as cost } from "./solution.mjs";

const bw = (pages, doubleSided = false) => ({ pages, color: false, doubleSided });
const colour = (pages, doubleSided = false) => ({ pages, color: true, doubleSided });

test("an empty request costs nothing", () => assert.equal(cost([]), 0));
test("black-and-white pages within the free allowance are free", () => assert.equal(cost([bw(8)]), 0));
test("black-and-white pages beyond the allowance cost 5 cents", () => assert.equal(cost([bw(20)]), 50));
test("colour pages cost 25 cents", () => assert.equal(cost([colour(4)]), 100));
test("double-sided takes 10% off the job", () => assert.equal(cost([colour(10, true)]), 225));
