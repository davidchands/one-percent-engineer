export function isBalanced(formula) {
  const count = { "(": 0, "[": 0, "{": 0 };
  const open = { ")": "(", "]": "[", "}": "{" };
  for (const ch of formula) {
    if (ch in count) count[ch]++;
    else if (ch in open) count[open[ch]]--;
  }
  return count["("] === 0 && count["["] === 0 && count["{"] === 0;
}
