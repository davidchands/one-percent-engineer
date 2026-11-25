export function bestStretch(takings, days) {
  if (!Number.isInteger(days) || days < 1 || days > takings.length) throw new RangeError("bad days");
  let best = -Infinity;
  for (let start = 0; start + days <= takings.length; start++) {
    let total = 0;
    for (let i = start; i < start + days; i++) total += takings[i];
    if (total > best) best = total;
  }
  return best;
}
