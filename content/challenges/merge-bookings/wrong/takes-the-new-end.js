export function mergeBookings(bookings) {
  const sorted = bookings.map(([s, e]) => [s, e]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = end;
    else merged.push([start, end]);
  }
  return merged;
}
