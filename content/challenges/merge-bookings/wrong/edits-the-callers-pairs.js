export function mergeBookings(bookings) {
  const sorted = [...bookings].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const booking of sorted) {
    const last = merged[merged.length - 1];
    if (last && booking[0] <= last[1]) last[1] = Math.max(last[1], booking[1]);
    else merged.push(booking);
  }
  return merged;
}
