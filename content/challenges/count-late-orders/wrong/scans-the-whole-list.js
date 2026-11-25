export function countAtLeast(sortedTimes, limit) {
  let count = 0;
  for (const t of sortedTimes) if (t >= limit) count++;
  return count;
}
