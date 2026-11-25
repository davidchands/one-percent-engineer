export function findPricePair(prices, voucher) {
  for (let i = 0; i < prices.length; i++) {
    for (let j = i + 1; j < prices.length; j++) {
      if (prices[i] + prices[j] === voucher) return [prices[i], prices[j]];
    }
  }
  return null;
}
