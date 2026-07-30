import React from "react"
import { EmailLayout } from "./layout"

export interface OrderInProgressEmailProps {
  order_id: string
  display_id?: string | number
  storefront_url?: string
  subject?: string
}

export function OrderInProgressEmail(props: OrderInProgressEmailProps) {
  const {
    display_id,
    storefront_url = "https://infinytree.com",
    order_id,
  } = props

  const orderNumber = display_id || order_id?.slice(-8) || "—"

  return (
    <EmailLayout preview={`Your Infinytree order #${orderNumber} is in progress`}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        Your Order is In Progress
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        Our team has begun preparing your handcrafted botanical piece. Every composition
        is individually assembled and carefully inspected before it leaves our workshop.
      </p>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        We'll notify you as soon as your order has been dispatched.
      </p>

      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
        <tr>
          <td align="center">
            <a
              href={`${storefront_url}/account/orders/details/${order_id}`}
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
              View Order Status
            </a>
          </td>
        </tr>
      </table>

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        Questions? Contact us at{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
