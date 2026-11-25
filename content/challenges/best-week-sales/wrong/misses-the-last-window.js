export function bestStretch(takings, days) {
  if (!Number.isInteger(days) || days < 1 || days > takings.length) throw new RangeError("bad days");
  let window = 0;
  for (let i = 0; i < days; i++) window += takings[i];
  let best = window;
  for (let i = days; i < takings.length - 1; i++) {
    window = window + takings[i] - takings[i - days];
    if (window > best) best = window;
  }
  return best;
}
