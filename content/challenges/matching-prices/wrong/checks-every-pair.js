export function findPair(prices, budget) {
  for (let j = 1; j < prices.length; j++) {
    for (let i = 0; i < j; i++) {
      if (prices[i] + prices[j] === budget) return [i, j];
    }
  }
  return null;
}
