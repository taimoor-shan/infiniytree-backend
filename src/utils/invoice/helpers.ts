/**
 * Pure utility functions for the invoice PDF.
 * No React / @react-pdf dependencies — safe to import anywhere.
 */

import type { InvoiceOrderData } from "./types"

/** Coerce database numeric values (MikroORM BigNumber / decimal) to plain number. */
export function toNum(v: any): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  return Number(v) || 0
}

/** Format a number as currency (en-US, min 2 fraction digits, defaults to EUR). */
export function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Format an ISO date string as a human-readable date (en-GB long format). */
export function fmtDate(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/** Add 14 days to an ISO date and return formatted. */
export function dueDate(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  d.setDate(d.getDate() + 14)
  return fmtDate(d.toISOString())
}

/** Extract a stable display ID from an order. */
export function getDisplayId(order: InvoiceOrderData): string {
  return String(order.display_id || order.id?.slice(-8) || "—")
}

/** Derive money totals with the same precedence as the current invoice. */
export function getTotals(order: InvoiceOrderData) {
  return {
    subtotal: order.item_subtotal ?? order.subtotal ?? 0,
    shipping: order.shipping_subtotal ?? order.shipping_total ?? 0,
    discount: order.discount_total ?? 0,
    tax: order.tax_total ?? 0,
    total: order.total ?? 0,
  }
}

/** Is this a Hungarian order? (affects VAT rate and note). */
export function isHungarian(order: InvoiceOrderData): boolean {
  return order.shipping_address?.country_code?.toLowerCase() === "hu"
}

/** VAT label for the totals section. */
export function getVatLabel(order: InvoiceOrderData): string {
  return isHungarian(order) ? "VAT (27%)" : "VAT (0%)"
}

/** Legal VAT note — both variants are preserved verbatim from the current invoice. */
export function getVatNote(order: InvoiceOrderData): string {
  return isHungarian(order)
    ? "Includes 27% VAT per Hungarian VAT law."
    : "Reverse charge applies (Art. 196 VAT Directive) — VAT not charged."
}

/** Extract VAT number from order or shipping-address metadata. */
export function getVatNumber(order: InvoiceOrderData): string | undefined {
  return (
    order.vat_number ||
    (order.shipping_address?.metadata?.vat_number as string) ||
    undefined
  )
}
