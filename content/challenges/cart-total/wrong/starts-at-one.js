export function cartTotal(prices) {
  let total = 0;
  for (let i = 1; i < prices.length; i++) total = total + prices[i];
  return total;
}
