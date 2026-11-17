import { test } from "node:test";
import assert from "node:assert/strict";
import { celsiusToFahrenheit } from "./solution.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);

test("negative temperatures: -40 °C is -40 °F", () => close(celsiusToFahrenheit(-40), -40));
test("decimals: 21.5 °C is 70.7 °F", () => close(celsiusToFahrenheit(21.5), 70.7));
test("body temperature: 37 °C is 98.6 °F", () => close(celsiusToFahrenheit(37), 98.6));
test("returns a number", () => assert.equal(typeof celsiusToFahrenheit(10), "number"));
