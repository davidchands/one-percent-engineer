// Reference solution. Revealed only if you explicitly ask for it.
function validateSku(sku) {
  if (typeof sku !== "string" || sku.length === 0) throw new TypeError(`Invalid SKU: ${String(sku)}`);
}
function validateQty(sku, qty) {
  if (!Number.isInteger(qty) || qty <= 0) throw new RangeError(`Invalid quantity for ${sku}: ${qty}`);
}

export function createInventory() {
  const stock = new Map(); // private to this inventory (closure)

  const quantity = (sku) => stock.get(sku) ?? 0;

  function removeMany(lines) {
    // 1. Validate everything and total the request per SKU. No mutation yet.
    const requested = new Map();
    for (const { sku, qty } of lines) {
      validateSku(sku);
      validateQty(sku, qty);
      requested.set(sku, (requested.get(sku) ?? 0) + qty);
    }
    // 2. Check the whole order against current stock.
    for (const [sku, qty] of requested) {
      if (qty > quantity(sku)) throw new Error(`Insufficient stock for ${sku}: requested ${qty}, have ${quantity(sku)}`);
    }
    // 3. Only now change state. Nothing below can throw.
    for (const [sku, qty] of requested) stock.set(sku, quantity(sku) - qty);
  }

  return {
    add(sku, qty) {
      validateSku(sku);
      validateQty(sku, qty);
      stock.set(sku, quantity(sku) + qty);
    },
    remove(sku, qty) {
      removeMany([{ sku, qty }]);
    },
    removeMany,
    quantity,
    snapshot() {
      return Object.fromEntries(stock);
    },
  };
}
