export function createInventory() {
  const stock = new Map();
  const q = (s) => stock.get(s) ?? 0;
  const check = (sku, qty) => {
    if (typeof sku !== "string" || !sku) throw new TypeError(String(sku));
    if (!Number.isInteger(qty) || qty <= 0) throw new RangeError(sku);
  };
  function removeMany(lines) {
    for (const { sku, qty } of lines) { check(sku, qty); if (qty > q(sku)) throw new Error(`Insufficient ${sku}`); }
    for (const { sku, qty } of lines) stock.set(sku, q(sku) - qty); // repeated SKUs never summed
  }
  return {
    add(sku, qty) { check(sku, qty); stock.set(sku, q(sku) + qty); },
    remove: (sku, qty) => removeMany([{ sku, qty }]),
    removeMany, quantity: q, snapshot: () => Object.fromEntries(stock),
  };
}
