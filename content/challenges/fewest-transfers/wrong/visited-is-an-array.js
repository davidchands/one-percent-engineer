export function fewestTransfers(routes, from, to) {
  const seen = [from];
  const queue = [[from, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [stop, hops] = queue[i];
    if (stop === to) return hops;
    for (const next of routes[stop] ?? []) {
      if (!seen.includes(next)) {
        seen.push(next);
        queue.push([next, hops + 1]);
      }
    }
  }
  return -1;
}
