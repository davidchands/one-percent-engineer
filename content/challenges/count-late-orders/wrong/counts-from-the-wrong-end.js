export function countAtLeast(sortedTimes, limit) {
  let low = 0;
  let high = sortedTimes.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sortedTimes[mid] < limit) low = mid + 1;
    else high = mid;
  }
  return low;
}
