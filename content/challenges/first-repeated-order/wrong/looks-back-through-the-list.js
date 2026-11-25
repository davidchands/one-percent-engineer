export function firstRepeat(scans) {
  for (let i = 1; i < scans.length; i++) {
    if (scans.indexOf(scans[i]) !== i) return scans[i];
  }
  return null;
}
