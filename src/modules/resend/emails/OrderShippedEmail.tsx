import React from "react"
import { EmailLayout } from "./layout"

export interface OrderShippedEmailProps {
  order_id: string
  display_id?: string | number
  tracking_numbers?: string[]
  tracking_url?: string
  fulfillment_id?: string
  storefront_url?: string
  subject?: string
}

export function OrderShippedEmail(props: OrderShippedEmailProps) {
  const {
    display_id,
    tracking_numbers,
    tracking_url,
    storefront_url = "https://infinytree.com",
    order_id,
  } = props

  const orderNumber = display_id || order_id?.slice(-8) || "—"
  const detailsUrl = `${storefront_url}/account/orders/details/${order_id}`

  return (
    <EmailLayout preview={`Your Infinytree order #${orderNumber} has shipped! 📦`}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        Your Order Has Shipped! 📦
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        Your Infinytree order is on its way. You can follow its journey using the
        tracking information below.
      </p>

      {tracking_numbers && tracking_numbers.length > 0 && (
        <>
          <h3 style={{ fontSize: "16px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
            Tracking Information
          </h3>
          <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "16px" }}>
            {tracking_numbers.map((tn, i) => (
              <tr key={i}>
                <td
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#f7f7f5",
                    borderRadius: "4px",
                    fontSize: "14px",
                    color: "#333",
                    fontFamily: "monospace",
                  }}
                >
                  {tn}
                </td>
              </tr>
            ))}
          </table>
        </>
      )}

      <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        Estimated delivery: <strong>3–10 business days</strong> within Europe.
        {!tracking_numbers?.length && (
          <> Tracking information will appear here once the carrier updates the shipment status.</>
        )}
      </p>

      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
        <tr>
          <td align="center">
            <a
              href={tracking_url || detailsUrl}
              style={{
                display: "inline-block",
                padding: "14px 36px",
                backgroundColor: "#2d4a3e",
                color: "#ffffff",
                fontSize: "15px",
                textDecoration: "none",
                borderRadius: "4px",
                fontWeight: 500,
              }}
            >
              {tracking_url ? "Track Shipment" : "View Order Status"}
            </a>
          </td>
        </tr>
      </table>

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        Questions about your shipment? Contact us at{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
