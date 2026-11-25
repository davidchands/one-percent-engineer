export function findPair(prices, budget) {
  for (let i = 0; i < prices.length; i++) {
    for (let j = i + 1; j < prices.length; j++) {
      if (prices[i] + prices[j] === budget) return [i, j];
    }
  }
  return null;
}
