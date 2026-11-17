export function cartTotal(prices) {
  let total = 0;
  for (let i = 0; i < prices.length - 1; i++) total = total + prices[i];
  return total;
}
