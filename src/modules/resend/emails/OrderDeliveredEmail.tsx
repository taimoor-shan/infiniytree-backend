import React from "react"
import { EmailLayout } from "./layout"

export interface OrderDeliveredEmailProps {
  order_id: string
  display_id?: string | number
  order_url?: string
  storefront_url?: string
  subject?: string
}

export function OrderDeliveredEmail(props: OrderDeliveredEmailProps) {
  const {
    display_id,
    storefront_url = "https://infinytree.com",
    order_id,
    order_url,
  } = props

  const orderNumber = display_id || order_id?.slice(-8) || "—"
  const detailsUrl = order_url || `${storefront_url}/account/orders/details/${order_id}`

  return (
    <EmailLayout preview={`Your Infinytree order #${orderNumber} has been delivered! 🎉`}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        Your Order Has Been Delivered! 🎉
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        We hope your new botanical piece has arrived safely and complements your
        space beautifully.
      </p>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        Thank you for choosing Infinytree. If you have any questions about your
        order, we're always here to help.
      </p>

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
