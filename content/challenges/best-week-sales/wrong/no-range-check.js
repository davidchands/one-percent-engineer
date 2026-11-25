export function bestStretch(takings, days) {
  let window = 0;
  for (let i = 0; i < days; i++) window += takings[i];
  let best = window;
  for (let i = days; i < takings.length; i++) {
    window = window + takings[i] - takings[i - days];
    if (window > best) best = window;
  }
  return best;
}
