export function isBalanced(formula) {
  let text = formula.replace(/[^()\[\]{}]/g, "");
  while (text.includes("()") || text.includes("[]") || text.includes("{}")) {
    text = text.replace("()", "").replace("[]", "").replace("{}", "");
  }
  return text.length === 0;
}
