export function fewestTransfers(routes, from, to) {
  const seen = new Set();
  function walk(stop, hops) {
    if (stop === to) return hops;
    seen.add(stop);
    for (const next of routes[stop] ?? []) {
      if (!seen.has(next)) {
        const found = walk(next, hops + 1);
        if (found !== -1) return found;
      }
    }
    return -1;
  }
  return walk(from, 0);
}
