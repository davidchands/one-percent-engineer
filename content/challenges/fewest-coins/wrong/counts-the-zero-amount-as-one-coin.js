export function fewestCoins(coins, amount) {
  if (amount === 0) return 1;
  const best = new Array(amount + 1).fill(Infinity);
  best[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a && best[a - coin] + 1 < best[a]) best[a] = best[a - coin] + 1;
    }
  }
  return best[amount] === Infinity ? -1 : best[amount];
}
