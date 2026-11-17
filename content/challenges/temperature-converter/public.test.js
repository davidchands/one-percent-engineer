import { test } from "node:test";
import assert from "node:assert/strict";
import { celsiusToFahrenheit } from "./solution.js";

test("freezing point: 0 °C is 32 °F", () => assert.equal(celsiusToFahrenheit(0), 32));
test("boiling point: 100 °C is 212 °F", () => assert.equal(celsiusToFahrenheit(100), 212));
