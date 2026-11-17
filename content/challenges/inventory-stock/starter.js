/*
 * 1% ENGINEER — DAILY CHALLENGE: Inventory that can never go negative
 *
 * Before coding:
 *  - Write the invariant: what must ALWAYS be true about stock?
 *  - For each method: what can go wrong, and what state is left afterwards?
 *  - Consider: an order with the same SKU on two lines.
 *
 * Don't look for a complete solution.
 */

export function createInventory() {
  return {
    add(sku, qty) {},
    remove(sku, qty) {},
    removeMany(lines) {},
    quantity(sku) {
      return 0;
    },
    snapshot() {
      return {};
    },
  };
}
