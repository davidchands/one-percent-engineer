export function averageGrade(grades) {
  if (grades.length === 0) return null;
  let total = 0;
  for (let i = 0; i < grades.length; i++) {
    const v = parseInt(grades[i], 10); // truncates "85.5" → 85
    if (Number.isNaN(v)) throw new TypeError(`index ${i}`);
    total += v;
  }
  return Math.round((total / grades.length) * 10) / 10;
}
export function topStudent(students) {
  let best = null, bestAvg = -Infinity;
  for (const s of students) {
    const avg = averageGrade(s.grades);
    if (avg === null) continue;
    if (avg > bestAvg || (avg === bestAvg && s.name < best)) { best = s.name; bestAvg = avg; }
  }
  return best;
}
