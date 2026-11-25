export function firstRepeat(scans) {
  const seen = new Set();
  for (const scan of scans) {
    if (seen.has(scan)) return scan;
    seen.add(scan);
  }
  return null;
}
