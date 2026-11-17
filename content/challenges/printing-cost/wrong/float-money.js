export function calculatePrintingCost(jobs) {
  let left = 10, total = 0;
  for (const job of jobs) {
    if (typeof job.pages !== "number") throw new TypeError();
    if (!Number.isInteger(job.pages) || job.pages <= 0) throw new RangeError();
    let billable = job.pages;
    if (!job.color) { const f = Math.min(left, billable); left -= f; billable -= f; }
    let price = billable * (job.color ? 25 : 5);
    if (job.doubleSided) price = price * 0.9; // never rounded
    total += price;
  }
  return total > 2000 ? total * 0.95 : total;
}
