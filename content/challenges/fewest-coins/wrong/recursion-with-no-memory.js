export function fewestCoins(coins, amount) {
  function solve(left) {
    if (left === 0) return 0;
    let best = Infinity;
    for (const coin of coins) {
      if (coin <= left) best = Math.min(best, solve(left - coin) + 1);
    }
    return best;
  }
  const result = solve(amount);
  return result === Infinity ? -1 : result;
}
