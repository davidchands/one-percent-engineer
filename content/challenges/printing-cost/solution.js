// Reference solution. Revealed only if you explicitly ask for it (and the attempt is then marked solution_viewed).
const RATE = { bw: 5, colour: 25 };
const FREE_BW_PAGES = 10;
const BULK_THRESHOLD = 2000;

function validate(job) {
  if (typeof job.pages !== "number") throw new TypeError("pages must be a number");
  if (!Number.isInteger(job.pages) || job.pages <= 0) throw new RangeError("pages must be a positive whole number");
}

/** Rounds a positive amount of cents × percent / 100 to the nearest cent, halves up, without floats drifting. */
const percentOf = (cents, percent) => Math.round((cents * percent) / 100);

export function calculatePrintingCost(jobs) {
  let allowanceLeft = FREE_BW_PAGES;
  let total = 0;

  for (const job of jobs) {
    validate(job);
    let billable = job.pages;
    if (!job.color) {
      const free = Math.min(allowanceLeft, job.pages);
      allowanceLeft -= free;
      billable -= free;
    }
    let price = billable * (job.color ? RATE.colour : RATE.bw);
    if (job.doubleSided) price = percentOf(price, 90);
    total += price;
  }

  return total > BULK_THRESHOLD ? percentOf(total, 95) : total;
}
