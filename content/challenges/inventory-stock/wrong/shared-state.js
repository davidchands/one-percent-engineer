const stock = new Map(); // module-level: shared by every inventory
export function createInventory() {
  const q = (s) => stock.get(s) ?? 0;
  const check = (sku, qty) => {
    if (typeof sku !== "string" || !sku) throw new TypeError(String(sku));
    if (!Number.isInteger(qty) || qty <= 0) throw new RangeError(sku);
  };
  function removeMany(lines) {
    const req = new Map();
    for (const { sku, qty } of lines) { check(sku, qty); req.set(sku, (req.get(sku) ?? 0) + qty); }
    for (const [sku, qty] of req) if (qty > q(sku)) throw new Error(`Insufficient ${sku}`);
    for (const [sku, qty] of req) stock.set(sku, q(sku) - qty);
  }
  return {
    add(sku, qty) { check(sku, qty); stock.set(sku, q(sku) + qty); },
    remove: (sku, qty) => removeMany([{ sku, qty }]),
    removeMany, quantity: q, snapshot: () => Object.fromEntries(stock),
  };
}
