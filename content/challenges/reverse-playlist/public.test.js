import { test } from "node:test";
import assert from "node:assert/strict";
import { reversePlaylist } from "./solution.js";

function build(values) {
  let head = null;
  for (let i = values.length - 1; i >= 0; i--) head = { value: values[i], next: head };
  return head;
}
function toArray(head) {
  const out = [];
  for (let n = head; n !== null; n = n.next) {
    out.push(n.value);
    if (out.length > 1000) throw new Error("the chain never ends: is there a loop?");
  }
  return out;
}

test("reverses a short playlist", () => assert.deepEqual(toArray(reversePlaylist(build(["a", "b", "c"]))), ["c", "b", "a"]));
test("a single song is its own reverse", () => assert.deepEqual(toArray(reversePlaylist(build(["a"]))), ["a"]));
test("an empty playlist stays empty", () => assert.equal(reversePlaylist(null), null));
