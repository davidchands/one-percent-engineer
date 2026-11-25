export function fewestCoins(coins, amount) {
  const sorted = [...coins].sort((a, b) => b - a);
  let left = amount;
  let count = 0;
  for (const coin of sorted) {
    count += Math.floor(left / coin);
    left = left % coin;
  }
  return left === 0 ? count : -1;
}
