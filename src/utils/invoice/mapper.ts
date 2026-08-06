/**
 * Order → InvoiceViewModel mapper.
 *
 * ALL business logic lives here — the PDF components are pure renderers.
 * Extracts VAT, formats dates, computes totals, resolves image fallbacks,
 * and produces a clean InvoiceViewModel that InvoiceDocument renders.
 */

import path from "path"
import {
  toNum,
  fmt,
  fmtDate,
  dueDate,
  getDisplayId,
  getTotals,
  isHungarian,
  getVatLabel,
  getVatNote,
  getVatNumber,
} from "./helpers"
import type { InvoiceOrderData, InvoiceViewModel, LineItem } from "./types"
import type { BankDetails } from "../bank-details"

// ---------------------------------------------------------------------------
// Placeholder product image (SVG — no binary file needed)
// ---------------------------------------------------------------------------

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
  <rect width="140" height="140" fill="#FAF8F5" rx="4"/>
  <rect x="1" y="1" width="138" height="138" rx="3" fill="none" stroke="#E9E6E1" stroke-width="1"/>
  <ellipse cx="70" cy="78" rx="28" ry="34" fill="none" stroke="#B08A42" stroke-width="1.5" opacity="0.5"/>
  <path d="M70 46 C 62 56, 76 66, 70 74" fill="none" stroke="#B08A42" stroke-width="1.5" opacity="0.5"/>
  <path d="M70 46 C 78 56, 64 66, 70 74" fill="none" stroke="#B08A42" stroke-width="1" opacity="0.3"/>
</svg>`
  ).toString("base64")

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

export function mapOrderToInvoice(
  order: InvoiceOrderData,
  bankDetails: BankDetails & { reference: string }
): InvoiceViewModel {
  const currency = order.currency_code || "eur"
  const displayId = getDisplayId(order)
  const { subtotal, shipping, discount, tax, total } = getTotals(order)
  console.log("[mapper-debug] getTotals result:", { subtotal, shipping, discount, tax, total })
  console.log("[mapper-debug] raw order totals:", {
    total: (order as any).total,
    subtotal: (order as any).subtotal,
    item_subtotal: (order as any).item_subtotal,
    shipping_total: (order as any).shipping_total,
    shipping_subtotal: (order as any).shipping_subtotal,
    discount_total: (order as any).discount_total,
    tax_total: (order as any).tax_total,
  })
  const isHU = isHungarian(order)
  const vatNumber = getVatNumber(order)

  // ---- Billing (shipping address) ----
  const addr = order.shipping_address

  // ---- Line items ----
  const items: LineItem[] = (order.items || []).map((item, idx) => {
    const qty = toNum(item.quantity)
    const price = toNum(item.unit_price)
    if (idx === 0) {
      console.log("[mapper-debug] raw item keys:", Object.keys(item).join(", "))
      console.log("[mapper-debug] item.title:", item.title)
      console.log("[mapper-debug] item.variant:", JSON.stringify(item.variant))
      console.log("[mapper-debug] item.variant?.title:", item.variant?.title)
      console.log("[mapper-debug] item.variant?.sku:", item.variant?.sku)
    }
    return {
      title: item.product?.title || (item as any).product_title || item.title || "Product",
      subtitle: item.variant?.title || (item as any).variant_title || undefined,
      sku: item.variant?.sku || (item as any).variant_sku || undefined,
      quantity: qty,
      unitPrice: fmt(price, currency),
      total: fmt(price * qty, currency),
      image: PLACEHOLDER_IMAGE,
    }
  })
  if (items.length > 0) {
    console.log("[mapper-debug] mapped LineItem[0]:", JSON.stringify(items[0]))
  }

  // ---- Totals ----
  const totals = {
    subtotal: fmt(subtotal, currency),
    ...(shipping > 0 ? { shipping: fmt(shipping, currency) } : {}),
    ...(discount > 0 ? { discount: fmt(discount, currency) } : {}),
    vatLabel: getVatLabel(order),
    vat: fmt(tax, currency),
    total: fmt(total, currency),
    vatNote: getVatNote(order),
  }

  // ---- Payment ----
  const payment = {
    bank: bankDetails.bankName,
    iban: bankDetails.iban,
    bic: bankDetails.bic,
    beneficiary: bankDetails.beneficiary,
    reference: bankDetails.reference,
  }

  return {
    invoiceNumber: `INV-${displayId}`,
    orderNumber: `#${displayId}`,
    issueDate: fmtDate(order.created_at),
    dueDate: dueDate(order.created_at),
    currency,
    billing: {
      company: addr?.company || undefined,
      firstName: addr?.first_name || undefined,
      lastName: addr?.last_name || undefined,
      address1: addr?.address_1 || undefined,
      address2: addr?.address_2 || undefined,
      city: addr?.city || undefined,
      postalCode: addr?.postal_code || undefined,
      country: addr?.country_code?.toUpperCase() || undefined,
      vat: vatNumber,
    },
    items,
    totals,
    payment,
  }
}
