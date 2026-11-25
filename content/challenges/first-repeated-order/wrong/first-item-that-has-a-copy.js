export function firstRepeat(scans) {
  const counts = new Map();
  for (const scan of scans) counts.set(scan, (counts.get(scan) ?? 0) + 1);
  for (const scan of scans) if (counts.get(scan) > 1) return scan;
  return null;
}
