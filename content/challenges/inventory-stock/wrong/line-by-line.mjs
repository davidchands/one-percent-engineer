export function createInventory() {
  const stock = new Map();
  const q = (s) => stock.get(s) ?? 0;
  const check = (sku, qty) => {
    if (typeof sku !== "string" || !sku) throw new TypeError(String(sku));
    if (!Number.isInteger(qty) || qty <= 0) throw new RangeError(sku);
  };
  const remove = (sku, qty) => {
    check(sku, qty);
    if (qty > q(sku)) throw new Error(`Insufficient ${sku}`);
    stock.set(sku, q(sku) - qty);
  };
  return {
    add(sku, qty) { check(sku, qty); stock.set(sku, q(sku) + qty); },
    remove,
    removeMany(lines) { for (const l of lines) remove(l.sku, l.qty); }, // not atomic
    quantity: q,
    snapshot: () => Object.fromEntries(stock),
  };
}
