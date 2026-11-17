// Reference fix. Revealed only if you explicitly ask for it.
// Bugs fixed: (1) <= off-by-one read undefined → NaN; (2) "85.5" + ... string concatenation;
// (3) empty list → 0/0 = NaN instead of null; (4) >= made the LAST tied student win.
export function averageGrade(grades) {
  if (grades.length === 0) return null;
  let total = 0;
  for (let i = 0; i < grades.length; i++) {
    const value = typeof grades[i] === "string" && grades[i].trim() !== "" ? Number(grades[i]) : grades[i];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new TypeError(`Grade at index ${i} is not numeric: ${JSON.stringify(grades[i])}`);
    }
    total += value;
  }
  return Math.round((total / grades.length) * 10) / 10;
}

export function topStudent(students) {
  let best = null;
  let bestAvg = -Infinity;
  for (const student of students) {
    const avg = averageGrade(student.grades);
    if (avg === null) continue;
    if (avg > bestAvg || (avg === bestAvg && student.name < best)) {
      best = student.name;
      bestAvg = avg;
    }
  }
  return best;
}
