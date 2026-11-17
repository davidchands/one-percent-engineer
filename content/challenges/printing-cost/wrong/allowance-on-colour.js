export function calculatePrintingCost(jobs) {
  let left = 10, total = 0;
  for (const job of jobs) {
    if (typeof job.pages !== "number") throw new TypeError();
    if (!Number.isInteger(job.pages) || job.pages <= 0) throw new RangeError();
    const free = Math.min(left, job.pages); // applies to colour too
    left -= free;
    let price = (job.pages - free) * (job.color ? 25 : 5);
    if (job.doubleSided) price = Math.round((price * 90) / 100);
    total += price;
  }
  return total > 2000 ? Math.round((total * 95) / 100) : total;
}
