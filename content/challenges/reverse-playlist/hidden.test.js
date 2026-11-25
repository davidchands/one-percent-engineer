import { test } from "node:test";
import assert from "node:assert/strict";
import { reversePlaylist } from "./solution.js";

function quick(fn, ms) {
  const start = performance.now();
  const result = fn();
  const took = performance.now() - start;
  assert.ok(took < ms, "took " + Math.round(took) + " ms, the limit is " + ms + " ms");
  return result;
}

function build(values) {
  let head = null;
  for (let i = values.length - 1; i >= 0; i--) head = { value: values[i], next: head };
  return head;
}
function toArray(head) {
  const out = [];
  for (let n = head; n !== null; n = n.next) {
    out.push(n.value);
    if (out.length > 1000000) throw new Error("the chain never ends: is there a loop?");
  }
  return out;
}

test("two songs", () => assert.deepEqual(toArray(reversePlaylist(build(["a", "b"]))), ["b", "a"]));
test("an even number of songs", () => assert.deepEqual(toArray(reversePlaylist(build([1, 2, 3, 4]))), [4, 3, 2, 1]));
test("the old head ends the chain", () => {
  const head = build([1, 2, 3]);
  reversePlaylist(head);
  assert.equal(head.next, null);
});
test("the old last node is the new head", () => {
  const head = build([1, 2, 3]);
  let last = head;
  while (last.next) last = last.next;
  assert.equal(reversePlaylist(head), last);
});
test("the same node objects are reused", () => {
  const head = build([1, 2, 3]);
  const nodes = [head, head.next, head.next.next];
  const reversed = reversePlaylist(head);
  assert.equal(reversed, nodes[2]);
  assert.equal(reversed.next, nodes[1]);
  assert.equal(reversed.next.next, nodes[0]);
});
test("reversing twice gives the original order", () => {
  const head = build([1, 2, 3, 4, 5]);
  assert.deepEqual(toArray(reversePlaylist(reversePlaylist(head))), [1, 2, 3, 4, 5]);
});
test("a playlist of 200,000 songs is reversed quickly, without overflowing the stack", () => {
  const values = Array.from({ length: 200000 }, (_, i) => i);
  const head = build(values);
  const reversed = quick(() => reversePlaylist(head), 300);
  assert.equal(reversed.value, 199999);
  let count = 0;
  for (let n = reversed; n !== null; n = n.next) count++;
  assert.equal(count, 200000);
});
