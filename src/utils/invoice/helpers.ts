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

/** ISO-4217 currencies with 0 minor units — no decimal places. */
export const ZERO_DECIMAL_CURRENCIES = new Set([
  "HUF", "JPY", "KRW", "TWD", "VND",
  "CLP", "PYG", "UGX", "RWF", "UZS", "KES",
])

/** Translates a key from the dictionaries the emails use (`createTranslator`, modules/resend/i18n). */
export type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * The invoice is written in the language the customer ordered in (en, de-AT,
 * de-DE or hu-HU, the email dictionaries' codes), and its numbers and dates
 * follow that country: 1.234,56 €, 5 454 545 Ft, 2026. november 7.
 * English keeps the format it always had, US numbers and a British date.
 */
const NUMBER_LOCALE: Record<string, string> = { en: "en-US" }
const DATE_LOCALE: Record<string, string> = { en: "en-GB" }

/** Format a number as currency (defaults to EUR). Zero-decimal currencies (HUF etc.) omit fraction digits. */
export function fmt(amount: number, currency: string, locale = "en"): string {
  const c = (currency || "EUR").toUpperCase()
  const zeroDecimals = ZERO_DECIMAL_CURRENCIES.has(c)
  return new Intl.NumberFormat(NUMBER_LOCALE[locale] ?? locale, {
    style: "currency",
    currency: c,
    minimumFractionDigits: zeroDecimals ? 0 : 2,
    maximumFractionDigits: zeroDecimals ? 0 : 2,
  }).format(amount)
}

/** Format a number WITHOUT the currency symbol/code — for product table cells where space is tight. */
export function fmtAmount(amount: number, currency: string, locale = "en"): string {
  const c = (currency || "EUR").toUpperCase()
  const zeroDecimals = ZERO_DECIMAL_CURRENCIES.has(c)
  return new Intl.NumberFormat(NUMBER_LOCALE[locale] ?? locale, {
    minimumFractionDigits: zeroDecimals ? 0 : 2,
    maximumFractionDigits: zeroDecimals ? 0 : 2,
  }).format(amount)
}

/** Format an ISO date string as a human-readable long date (7 November 2026). */
export function fmtDate(iso?: string, locale = "en"): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale] ?? locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/** Add 14 days to an ISO date and return formatted. */
export function dueDate(iso?: string, locale = "en"): string {
  if (!iso) return "—"
  const d = new Date(iso)
  d.setDate(d.getDate() + 14)
  return fmtDate(d.toISOString(), locale)
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
    // Net, like the subtotal, shipping and VAT beside it. `discount_total` also
    // counts the VAT on the discount, so with it the rows would not add up.
    discount: order.discount_subtotal ?? order.discount_total ?? 0,
    tax: order.tax_total ?? 0,
    total: order.total ?? 0,
  }
}

/** Is this a Hungarian order? (affects VAT rate and note). */
export function isHungarian(order: InvoiceOrderData): boolean {
  return order.shipping_address?.country_code?.toLowerCase() === "hu"
}

/** VAT label for the totals section. */
export function getVatLabel(order: InvoiceOrderData, t: Translate): string {
  return `${t("invoice.vat")} (${isHungarian(order) ? 27 : 0}%)`
}

/** Legal VAT note — the wording of the current invoice, in the customer's language. */
export function getVatNote(order: InvoiceOrderData, t: Translate): string {
  return t(isHungarian(order) ? "invoice.vatNote.domestic" : "invoice.vatNote.reverseCharge")
}

/** Extract VAT number from order or shipping-address metadata. */
export function getVatNumber(order: InvoiceOrderData): string | undefined {
  return (
    order.vat_number ||
    (order.shipping_address?.metadata?.vat_number as string) ||
    undefined
  )
}
