export function findPricePair(prices, voucher) {
  let left = 0;
  let right = prices.length - 1;
  while (left < right) {
    const sum = prices[left] + prices[right];
    if (sum === voucher) return [left, right];
    if (sum < voucher) left++;
    else right--;
  }
  return null;
}
