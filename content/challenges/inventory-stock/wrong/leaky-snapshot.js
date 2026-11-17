export function createInventory() {
  const stock = {}; // plain object...
  const q = (s) => stock[s] ?? 0;
  const check = (sku, qty) => {
    if (typeof sku !== "string" || !sku) throw new TypeError(String(sku));
    if (!Number.isInteger(qty) || qty <= 0) throw new RangeError(sku);
  };
  function removeMany(lines) {
    const req = {};
    for (const { sku, qty } of lines) { check(sku, qty); req[sku] = (req[sku] ?? 0) + qty; }
    for (const sku in req) if (req[sku] > q(sku)) throw new Error(`Insufficient ${sku}`);
    for (const sku in req) stock[sku] = q(sku) - req[sku];
  }
  return {
    add(sku, qty) { check(sku, qty); stock[sku] = q(sku) + qty; },
    remove: (sku, qty) => removeMany([{ sku, qty }]),
    removeMany, quantity: q,
    snapshot: () => stock, // ...returned by reference
  };
}
