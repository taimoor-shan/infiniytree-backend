import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator, resolveLocale } from "../i18n"
import { formatPrice } from "../i18n/money"

export interface OrderConfirmedEmailProps {
  id: string
  display_id?: string | number
  email?: string
  created_at?: string
  currency_code?: string
  items?: Array<{
    title: string
    quantity: number
    unit_price: number
    thumbnail?: string
    product?: { title: string }
  }>
  shipping_address?: {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    postal_code?: string
    country_code?: string
    phone?: string
  }
  total?: number
  subtotal?: number
  shipping_total?: number
  discount_total?: number
  tax_total?: number
  payment_method?: {
    provider_id: string
    amount: number
  }
  order_url?: string
  vat_number?: string
  storefront_url?: string
  subject?: string
  locale?: string
}

const PAYMENT_PROVIDER_MAP: Record<string, string> = {
  pp_paypal_paypal: "email.payment.paypal",
  pp_stripe_applepay: "email.payment.applepay",
  pp_stripe_googlepay: "email.payment.googlepay",
  "pp_stripe-ideal_stripe": "email.payment.ideal",
  "pp_stripe-bancontact_stripe": "email.payment.bancontact",
  pp_system_default: "email.payment.bankTransfer",
}

function getPaymentLabel(providerId: string, t: (key: string) => string): string {
  const key = PAYMENT_PROVIDER_MAP[providerId]
  return key ? t(key) : t("email.payment.creditCard")
}

/**
 * Rich order confirmation email with item table, totals, and shipping info.
 */
export function OrderConfirmedEmail(props: OrderConfirmedEmailProps) {
  const {
    id,
    display_id,
    items = [],
    shipping_address,
    currency_code = "eur",
    total,
    subtotal,
    shipping_total,
    discount_total,
    tax_total,
    payment_method,
    order_url,
    storefront_url = "https://infinytree.com",
    created_at,
    locale = "en",
  } = props

  const t = createTranslator(locale)
  const resolvedLocale = resolveLocale(locale)

  const orderNumber = display_id || id?.slice(-8) || "—"
  const orderDate = created_at
    ? new Date(created_at).toLocaleDateString(resolvedLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—"

  const fmt = (amount?: number) =>
    amount != null ? formatPrice(amount, currency_code, resolvedLocale) : "—"

  return (
    <EmailLayout
      preview={t("email.orderConfirmed.preview", { orderNumber })}
      locale={locale}
    >
      {/* Heading */}
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        {t("email.orderConfirmed.heading")}
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        {t("email.orderConfirmed.intro")}
      </p>

      {/* Order Meta */}
      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
        <tr>
          <td style={{ paddingRight: "24px", verticalAlign: "top" }}>
            <p style={{ fontSize: "12px", color: "#999", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("email.orderConfirmed.orderNumberLabel")}
            </p>
            <p style={{ fontSize: "15px", color: "#333", margin: 0, fontWeight: 600 }}>
              #{orderNumber}
            </p>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <p style={{ fontSize: "12px", color: "#999", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("email.orderConfirmed.dateLabel")}
            </p>
            <p style={{ fontSize: "15px", color: "#333", margin: 0 }}>
              {orderDate}
            </p>
          </td>
        </tr>
      </table>

      {/* Items Table */}
      <h3 style={{ fontSize: "16px", color: "#2d4a3e", margin: "0 0 12px", fontWeight: 400 }}>
        {t("email.orderConfirmed.itemsLabel")}
      </h3>
      <table
        cellPadding="0"
        cellSpacing="0"
        border={0}
        width="100%"
        style={{ marginBottom: "24px" }}
      >
        <thead>
          <tr>
            <th
              style={{
                fontSize: "12px",
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                textAlign: "left",
                paddingBottom: "8px",
                borderBottom: "1px solid #e8e8e4",
                fontWeight: 400,
              }}
            >
              {t("email.orderConfirmed.product")}
            </th>
            <th
              style={{
                fontSize: "12px",
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                textAlign: "center",
                paddingBottom: "8px",
                borderBottom: "1px solid #e8e8e4",
                fontWeight: 400,
              }}
            >
              {t("email.orderConfirmed.qty")}
            </th>
            <th
              style={{
                fontSize: "12px",
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                textAlign: "right",
                paddingBottom: "8px",
                borderBottom: "1px solid #e8e8e4",
                fontWeight: 400,
              }}
            >
              {t("email.orderConfirmed.price")}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td
                style={{
                  padding: "12px 8px 12px 0",
                  borderBottom: "1px solid #f0f0ee",
                  fontSize: "14px",
                  color: "#333",
                }}
              >
                {item.product?.title || item.title || "Product"}
              </td>
              <td
                style={{
                  padding: "12px 8px",
                  borderBottom: "1px solid #f0f0ee",
                  fontSize: "14px",
                  color: "#555",
                  textAlign: "center",
                }}
              >
                {item.quantity}
              </td>
              <td
                style={{
                  padding: "12px 0 12px 8px",
                  borderBottom: "1px solid #f0f0ee",
                  fontSize: "14px",
                  color: "#333",
                  textAlign: "right",
                }}
              >
                {fmt(item.unit_price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <table
        cellPadding="0"
        cellSpacing="0"
        border={0}
        width="100%"
        style={{ marginBottom: "24px" }}
      >
        <tbody>
          {subtotal != null && (
            <tr>
              <td style={{ fontSize: "14px", color: "#555", padding: "3px 0" }}>
                {t("email.orderConfirmed.subtotal")}
              </td>
              <td style={{ fontSize: "14px", color: "#333", textAlign: "right", padding: "3px 0" }}>
                {fmt(subtotal)}
              </td>
            </tr>
          )}
          {shipping_total != null && (
            <tr>
              <td style={{ fontSize: "14px", color: "#555", padding: "3px 0" }}>
                {t("email.orderConfirmed.shipping")}
              </td>
              <td style={{ fontSize: "14px", color: "#333", textAlign: "right", padding: "3px 0" }}>
                {shipping_total === 0 ? t("email.orderConfirmed.free") : fmt(shipping_total)}
              </td>
            </tr>
          )}
          {discount_total != null && discount_total > 0 && (
            <tr>
              <td style={{ fontSize: "14px", color: "#d44", padding: "3px 0" }}>
                {t("email.orderConfirmed.discount")}
              </td>
              <td style={{ fontSize: "14px", color: "#d44", textAlign: "right", padding: "3px 0" }}>
                −{fmt(discount_total)}
              </td>
            </tr>
          )}
          {tax_total != null && (
            <tr>
              <td style={{ fontSize: "14px", color: "#555", padding: "3px 0" }}>
                {t("email.orderConfirmed.tax")}
              </td>
              <td style={{ fontSize: "14px", color: "#333", textAlign: "right", padding: "3px 0" }}>
                {fmt(tax_total)}
              </td>
            </tr>
          )}
          <tr>
            <td
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#2d4a3e",
                padding: "8px 0",
                borderTop: "2px solid #e8e8e4",
              }}
            >
              {t("email.orderConfirmed.total")}
            </td>
            <td
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#2d4a3e",
                textAlign: "right",
                padding: "8px 0",
                borderTop: "2px solid #e8e8e4",
              }}
            >
              {fmt(total)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Shipping Address */}
      {shipping_address && (
        <>
          <h3 style={{ fontSize: "16px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
            {t("email.orderConfirmed.shippingAddress")}
          </h3>
          <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
            {shipping_address.first_name} {shipping_address.last_name}
            {shipping_address.company && (
              <>
                <br />
                {shipping_address.company}
              </>
            )}
            {props.vat_number && (
              <>
                <br />
                {t("email.orderConfirmed.vat")}: {props.vat_number}
              </>
            )}
            <br />
            {shipping_address.address_1}
            {shipping_address.address_2 && (
              <>
                <br />
                {shipping_address.address_2}
              </>
            )}
            <br />
            {shipping_address.postal_code} {shipping_address.city}
            {shipping_address.country_code && (
              <>
                <br />
                {shipping_address.country_code.toUpperCase()}
              </>
            )}
            {shipping_address.phone && (
              <>
                <br />
                {shipping_address.phone}
              </>
            )}
          </p>
        </>
      )}

      {/* Payment Method */}
      {props.payment_method && (
        <>
          <h3 style={{ fontSize: "16px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
            {t("email.orderConfirmed.payment")}
          </h3>
          <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
            {getPaymentLabel(props.payment_method.provider_id, t)}{" "}
            — {fmt(props.payment_method.amount)}
          </p>
        </>
      )}

      {/* CTA — registered users only */}
      {order_url ? (
        <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "16px" }}>
          <tr>
            <td align="center">
              <a
                href={order_url}
                style={{
                  display: "inline-block",
                  padding: "12px 32px",
                  backgroundColor: "#2d4a3e",
                  color: "#ffffff",
                  fontSize: "14px",
                  textDecoration: "none",
                  borderRadius: "4px",
                  fontWeight: 500,
                }}
              >
                {t("email.orderConfirmed.viewOrder")}
              </a>
            </td>
          </tr>
        </table>
      ) : (
        <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
          {t("email.orderConfirmed.processingNote")}
        </p>
      )}

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        {t("email.orderConfirmed.contactPrefix")}{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
