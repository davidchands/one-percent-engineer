/*
 * 1% ENGINEER — DEBUGGING CHALLENGE: the grade report that says NaN
 *
 * This is the CURRENT, BROKEN code. It has more than one bug.
 * Reproduce → isolate → hypothesise → verify → fix. One bug at a time.
 * Write down each hypothesis BEFORE changing code.
 */

export function averageGrade(grades) {
  let total = 0;
  for (let i = 0; i <= grades.length; i++) {
    total += grades[i];
  }
  return Math.round((total / grades.length) * 10) / 10;
}

export function topStudent(students) {
  let best = null;
  let bestAvg = -Infinity;
  for (const student of students) {
    const avg = averageGrade(student.grades);
    if (avg >= bestAvg) {
      best = student.name;
      bestAvg = avg;
    }
  }
  return best;
}
