export function firstRepeat(scans) {
  const sorted = scans.sort();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) return sorted[i];
  }
  return null;
}
