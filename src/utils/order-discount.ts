/**
 * What a promotion code did to an order, for the people who read the order:
 * the confirmation email and the pro-forma invoice.
 *
 * Medusa keeps the discount in two figures. `discount_total` includes the VAT
 * on the discount, `discount_subtotal` does not. Everything else those two
 * documents print (subtotal, shipping, VAT) is net, so only the net figure adds
 * up to the total: 5 454 545 + 20 000 − 1 090 909 + 1 183 582 = 5 567 218,
 * where the gross 1 385 454 would be off by the VAT on the discount.
 */

type Adjustment = { code?: string | null }
type Adjusted = { adjustments?: Adjustment[] | null }

/** Medusa hands totals over as BigNumber objects (`numeric_`) as well as numbers */
const num = (v: any): number => {
  if (v == null) return 0
  if (typeof v === "number") return v
  return Number(v?.numeric_ ?? v) || 0
}

/**
 * The promotion codes an order used, each once, in the order they first appear.
 * A code lives on the adjustments of the lines (and shipping methods) it
 * reduced, so this reads the order's `items` (and `shipping_methods`, when
 * loaded), which `retrieveOrder` returns with their adjustments.
 */
export function discountCodes(
  order:
    | { items?: Adjusted[] | null; shipping_methods?: Adjusted[] | null }
    | null
    | undefined
): string[] {
  const codes = new Set<string>()
  for (const line of [...(order?.items ?? []), ...(order?.shipping_methods ?? [])]) {
    for (const adjustment of line?.adjustments ?? []) {
      const code = adjustment?.code?.trim()
      if (code) codes.add(code)
    }
  }
  return [...codes]
}

/** "Discount (CODE)", or just "Discount" when no code explains the reduction */
export function discountLabel(label: string, codes?: readonly string[] | null): string {
  return codes?.length ? `${label} (${codes.join(", ")})` : label
}

/**
 * The discount fields the email and the invoice take from an order:
 * the net discount (left out when the order does not carry it, so the gross
 * `discount_total` still serves) and the codes.
 */
export function discountFields(order: any): {
  discount_subtotal?: number
  discount_codes: string[]
} {
  const net = order?.discount_subtotal
  return {
    ...(net != null ? { discount_subtotal: num(net) } : {}),
    discount_codes: discountCodes(order),
  }
}
