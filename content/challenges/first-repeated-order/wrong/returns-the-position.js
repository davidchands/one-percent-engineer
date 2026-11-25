export function firstRepeat(scans) {
  const seen = new Set();
  for (let i = 0; i < scans.length; i++) {
    if (seen.has(scans[i])) return i;
    seen.add(scans[i]);
  }
  return null;
}
