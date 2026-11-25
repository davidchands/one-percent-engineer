export function findPair(prices, budget) {
  const seen = new Set();
  for (let j = 0; j < prices.length; j++) {
    const need = budget - prices[j];
    if (seen.has(need)) return [need, prices[j]];
    seen.add(prices[j]);
  }
  return null;
}
