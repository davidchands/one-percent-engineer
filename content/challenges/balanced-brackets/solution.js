export function isBalanced(formula) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const opening = new Set(["(", "[", "{"]);
  const stack = [];
  for (const ch of formula) {
    if (opening.has(ch)) stack.push(ch);
    else if (pairs[ch] !== undefined) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}
