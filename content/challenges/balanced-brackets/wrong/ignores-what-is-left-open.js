export function isBalanced(formula) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of formula) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (pairs[ch] !== undefined) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return true;
}
