export function calculatePrintingCost(jobs) {
  let left = 10, total = 0;
  for (const job of jobs) {
    let billable = job.pages;
    if (!job.color) { const f = Math.min(left, billable); left -= f; billable -= f; }
    let price = billable * (job.color ? 25 : 5);
    if (job.doubleSided) price = Math.round((price * 90) / 100);
    total += price;
  }
  return total > 2000 ? Math.round((total * 95) / 100) : total;
}
