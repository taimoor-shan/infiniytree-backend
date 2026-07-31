import React from "react"
import { EmailLayout } from "./layout"

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
  storefront_url?: string
  subject?: string
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
  } = props

  const orderNumber = display_id || id?.slice(-8) || "—"
  const orderDate = created_at
    ? new Date(created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—"

  const formatPrice = (amount?: number) =>
    amount != null
      ? new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: currency_code.toUpperCase(),
        }).format(amount / 100)
      : "—"

  return (
    <EmailLayout preview={`Order #${orderNumber} confirmed — thank you for your purchase!`}>
      {/* Heading */}
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        Thank You for Your Order! 🌿
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        Our team will review and will contact you within 48 hours (working days). Here is a summary of your purchase:
      </p>

      {/* Order Meta */}
      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
        <tr>
          <td style={{ paddingRight: "24px", verticalAlign: "top" }}>
            <p style={{ fontSize: "12px", color: "#999", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Order Number
            </p>
            <p style={{ fontSize: "15px", color: "#333", margin: 0, fontWeight: 600 }}>
              #{orderNumber}
            </p>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <p style={{ fontSize: "12px", color: "#999", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Date
            </p>
            <p style={{ fontSize: "15px", color: "#333", margin: 0 }}>
              {orderDate}
            </p>
          </td>
        </tr>
      </table>

      {/* Items Table */}
      <h3 style={{ fontSize: "16px", color: "#2d4a3e", margin: "0 0 12px", fontWeight: 400 }}>
        Items
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
              Product
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
              Qty
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
              Price
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
                {formatPrice(item.unit_price * item.quantity)}
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
              <td style={{ fontSize: "14px", color: "#555", padding: "3px 0" }}>Subtotal</td>
              <td style={{ fontSize: "14px", color: "#333", textAlign: "right", padding: "3px 0" }}>
                {formatPrice(subtotal)}
              </td>
            </tr>
          )}
          {shipping_total != null && (
            <tr>
              <td style={{ fontSize: "14px", color: "#555", padding: "3px 0" }}>Shipping</td>
              <td style={{ fontSize: "14px", color: "#333", textAlign: "right", padding: "3px 0" }}>
                {shipping_total === 0 ? "Free" : formatPrice(shipping_total)}
              </td>
            </tr>
          )}
          {discount_total != null && discount_total > 0 && (
            <tr>
              <td style={{ fontSize: "14px", color: "#d44", padding: "3px 0" }}>Discount</td>
              <td style={{ fontSize: "14px", color: "#d44", textAlign: "right", padding: "3px 0" }}>
                −{formatPrice(discount_total)}
              </td>
            </tr>
          )}
          {tax_total != null && (
            <tr>
              <td style={{ fontSize: "14px", color: "#555", padding: "3px 0" }}>Tax</td>
              <td style={{ fontSize: "14px", color: "#333", textAlign: "right", padding: "3px 0" }}>
                {formatPrice(tax_total)}
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
              Total
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
              {formatPrice(total)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Shipping Address */}
      {shipping_address && (
        <>
          <h3 style={{ fontSize: "16px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
            Shipping Address
          </h3>
          <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
            {shipping_address.first_name} {shipping_address.last_name}
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
            Payment
          </h3>
          <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
            {props.payment_method.provider_id === "pp_paypal_paypal"
              ? "PayPal"
              : props.payment_method.provider_id === "pp_stripe_applepay"
                ? "Apple Pay"
                : props.payment_method.provider_id === "pp_stripe_googlepay"
                  ? "Google Pay"
                  : props.payment_method.provider_id === "pp_stripe-ideal_stripe"
                    ? "iDeal"
                    : props.payment_method.provider_id === "pp_stripe-bancontact_stripe"
                      ? "Bancontact"
                      : props.payment_method.provider_id === "pp_system_default"
                        ? "Bank Transfer"
                        : "Credit Card"}{" "}
            — {formatPrice(props.payment_method.amount)}
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
                View Your Order
              </a>
            </td>
          </tr>
        </table>
      ) : (
        <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
          Your order is being processed. You will receive updates by email as your order progresses.
        </p>
      )}

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        If you have any questions, reply to this email or contact us at{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
