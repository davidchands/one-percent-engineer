export function calculatePrintingCost(jobs) {
  let total = 0;
  for (const job of jobs) {
    if (typeof job.pages !== "number") throw new TypeError();
    if (!Number.isInteger(job.pages) || job.pages <= 0) throw new RangeError();
    const billable = job.color ? job.pages : Math.max(0, job.pages - 10); // every job gets 10 free
    let price = billable * (job.color ? 25 : 5);
    if (job.doubleSided) price = Math.round((price * 90) / 100);
    total += price;
  }
  return total > 2000 ? Math.round((total * 95) / 100) : total;
}
