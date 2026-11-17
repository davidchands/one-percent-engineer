export function averageGrade(grades) {
  let total = 0;
  for (let i = 0; i < grades.length; i++) {
    const v = Number(grades[i]);
    if (Number.isNaN(v)) throw new TypeError(`index ${i}`);
    total += v;
  }
  return grades.length ? Math.round((total / grades.length) * 10) / 10 : 0; // 0, not null
}
export function topStudent(students) {
  let best = null, bestAvg = -Infinity;
  for (const s of students) {
    const avg = averageGrade(s.grades);
    if (avg > bestAvg || (avg === bestAvg && s.name < best)) { best = s.name; bestAvg = avg; }
  }
  return best;
}
