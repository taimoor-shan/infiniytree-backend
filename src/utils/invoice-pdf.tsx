/**
 * Invoice PDF template for Infinytree B2B orders.
 * Uses @react-pdf/renderer — generates PDF on-demand from API routes.
 */

import React from "react"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
}: Record<string, any> = require("@react-pdf/renderer")
import { getBankDetails } from "./bank-details"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceOrderData {
  id: string
  display_id?: string | number
  created_at?: string
  currency_code?: string
  email?: string
  shipping_address?: {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    postal_code?: string
    country_code?: string
    metadata?: Record<string, unknown>
  }
  items?: Array<{
    title: string
    quantity: number
    unit_price: number
    product?: { title: string }
  }>
  total?: number
  subtotal?: number
  item_subtotal?: number
  shipping_total?: number
  shipping_subtotal?: number
  discount_total?: number
  tax_total?: number
  vat_number?: string
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: "#333", lineHeight: 1.5 },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    marginBottom: 36, borderBottom: "1pt solid #2d4a3e", paddingBottom: 16,
  },
  name: { fontSize: 22, color: "#2d4a3e", fontFamily: "Helvetica-Bold" },
  info: { fontSize: 9, color: "#666", marginTop: 4 },
  metaRight: { textAlign: "right", fontSize: 10 },
  invTitle: { fontSize: 16, color: "#2d4a3e", fontFamily: "Helvetica-Bold", marginBottom: 4 },
  sectionTitle: {
    fontSize: 12, fontFamily: "Helvetica-Bold", color: "#2d4a3e",
    marginBottom: 8, borderBottom: "0.5pt solid #e8e8e4", paddingBottom: 4,
  },
  section: { marginBottom: 24 },
  tableHdr: {
    flexDirection: "row", borderBottom: "1pt solid #2d4a3e",
    paddingBottom: 6, marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row", borderBottom: "0.5pt solid #e8e8e4", paddingVertical: 6,
  },
  cItem: { flex: 3 }, cQty: { flex: 1, textAlign: "center" },
  cPrice: { flex: 1.5, textAlign: "right" }, cTotal: { flex: 1.5, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: "50%", marginBottom: 24 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  tLabel: { color: "#555" }, tVal: { fontFamily: "Helvetica-Bold" },
  tDiv: { borderTop: "1pt solid #2d4a3e", marginTop: 4, paddingTop: 4 },
  vatNote: { fontSize: 9, color: "#888", marginTop: 4, fontStyle: "italic" },
  due: { marginTop: 4, color: "#d44", fontFamily: "Helvetica-Bold", fontSize: 10 },
  payBlock: { border: "1pt solid #e8e8e4", padding: 12, borderRadius: 2, marginBottom: 24 },
  payRow: { flexDirection: "row", marginBottom: 2 },
  payLabel: { width: 100, color: "#555" },
  payVal: { flex: 1, fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute", bottom: 36, left: 48, right: 48,
    fontSize: 8, color: "#aaa", textAlign: "center",
    borderTop: "0.5pt solid #e8e8e4", paddingTop: 8,
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: any): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  return Number(v) || 0
}

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: currency || "EUR", minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric", month: "long", day: "numeric",
  })
}

function dueDate(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  d.setDate(d.getDate() + 14)
  return fmtDate(d.toISOString())
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

function InvoiceDocument({
  order, bankDetails,
}: {
  order: InvoiceOrderData
  bankDetails: ReturnType<typeof getBankDetails>
}) {
  const currency = order.currency_code || "eur"
  const displayId = order.display_id || order.id?.slice(-8) || "—"
  const vatNumber =
    order.vat_number ||
    (order.shipping_address?.metadata?.vat_number as string) ||
    undefined
  const isHU = order.shipping_address?.country_code?.toLowerCase() === "hu"
  // Prefer Medusa's computed net fields; fall back to legacy fields for backward compat
  const subtotal = order.item_subtotal ?? order.subtotal ?? 0
  const shipping = order.shipping_subtotal ?? order.shipping_total ?? 0
  const discount = order.discount_total ?? 0
  const tax = order.tax_total ?? 0
  const total = order.total ?? 0
  const items = order.items || []

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.name}>Infinytree</Text>
            <Text style={s.info}>Deltalivings Kft.</Text>
            <Text style={s.info}>1065 Budapest, Podmaniczky utca 19, Hungary</Text>
            <Text style={s.info}>Tax: 32214460-2-42</Text>
          </View>
          <View style={s.metaRight}>
            <Text style={s.invTitle}>INVOICE</Text>
            <Text>INV-{displayId}</Text>
            <Text>Order: #{displayId}</Text>
            <Text>Date: {fmtDate(order.created_at)}</Text>
            <Text style={s.due}>Due: {dueDate(order.created_at)}</Text>
          </View>
        </View>

        {/* Buyer */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Bill To</Text>
          {order.shipping_address?.company && (
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              {order.shipping_address.company}
            </Text>
          )}
          <Text>
            {order.shipping_address?.first_name}{" "}
            {order.shipping_address?.last_name}
          </Text>
          <Text>{order.shipping_address?.address_1}</Text>
          {order.shipping_address?.address_2 && (
            <Text>{order.shipping_address.address_2}</Text>
          )}
          <Text>
            {order.shipping_address?.postal_code}{" "}
            {order.shipping_address?.city}
          </Text>
          {order.shipping_address?.country_code && (
            <Text>{order.shipping_address.country_code.toUpperCase()}</Text>
          )}
          {vatNumber && <Text style={{ marginTop: 4 }}>VAT: {vatNumber}</Text>}
        </View>

        {/* Items */}
        <View style={{ marginBottom: 24 }}>
          <View style={s.tableHdr}>
            <Text style={s.cItem}>Product</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cPrice}>Unit Price</Text>
            <Text style={s.cTotal}>Total</Text>
          </View>
          {items.map((item, i) => (
            <View style={s.tableRow} key={i}>
              <Text style={s.cItem}>
                {item.product?.title || item.title || "Product"}
              </Text>
              <Text style={s.cQty}>{item.quantity}</Text>
              <Text style={s.cPrice}>{fmt(toNum(item.unit_price), currency)}</Text>
              <Text style={s.cTotal}>
                {fmt(toNum(item.unit_price) * item.quantity, currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totals}>
          <View style={s.tRow}>
            <Text style={s.tLabel}>Subtotal</Text>
            <Text>{fmt(subtotal, currency)}</Text>
          </View>
          {shipping > 0 && (
            <View style={s.tRow}>
              <Text style={s.tLabel}>Shipping</Text>
              <Text>{fmt(shipping, currency)}</Text>
            </View>
          )}
          {discount > 0 && (
            <View style={s.tRow}>
              <Text style={s.tLabel}>Discount</Text>
              <Text>-{fmt(discount, currency)}</Text>
            </View>
          )}
          <View style={s.tRow}>
            <Text style={s.tLabel}>VAT{isHU ? " (27%)" : " (0%)"}</Text>
            <Text>{fmt(tax, currency)}</Text>
          </View>
          <View style={[s.tRow, s.tDiv]}>
            <Text style={s.tLabel}>Total</Text>
            <Text style={s.tVal}>{fmt(total, currency)}</Text>
          </View>
          <Text style={s.vatNote}>
            {isHU
              ? "Includes 27% VAT per Hungarian VAT law."
              : "Reverse charge applies (Art. 196 VAT Directive) — VAT not charged."}
          </Text>
        </View>

        {/* Payment Details */}
        <View style={s.payBlock}>
          <Text style={s.sectionTitle}>Payment by Bank Transfer</Text>
          <View style={s.payRow}>
            <Text style={s.payLabel}>Bank:</Text>
            <Text style={s.payVal}>{bankDetails.bankName}</Text>
          </View>
          <View style={s.payRow}>
            <Text style={s.payLabel}>IBAN:</Text>
            <Text style={s.payVal}>{bankDetails.iban}</Text>
          </View>
          <View style={s.payRow}>
            <Text style={s.payLabel}>BIC:</Text>
            <Text style={s.payVal}>{bankDetails.bic}</Text>
          </View>
          <View style={s.payRow}>
            <Text style={s.payLabel}>Beneficiary:</Text>
            <Text style={s.payVal}>{bankDetails.beneficiary}</Text>
          </View>
          <View style={s.payRow}>
            <Text style={s.payLabel}>Reference:</Text>
            <Text style={s.payVal}>{bankDetails.reference}</Text>
          </View>
        </View>

        {/* Amount Due */}
        <View style={{ alignSelf: "flex-end" }}>
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: "#2d4a3e" }}>
            Amount Due: {fmt(total, currency)}
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text>
            Infinytree — Artificial Handmade Plants | Deltalivings Kft. |
            1065 Budapest, Podmaniczky utca 19, Hungary | Tax: 32214460-2-42
          </Text>
          <Text>
            Payment is due within 14 days. Order processing begins after payment is received.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function generateInvoiceBuffer(
  order: InvoiceOrderData
): Promise<Buffer> {
  const displayId = order.display_id || order.id?.slice(-8)
  const bankDetails = getBankDetails(displayId)
  return renderToBuffer(
    React.createElement(InvoiceDocument, { order, bankDetails }) as unknown as React.ReactElement
  )
}
