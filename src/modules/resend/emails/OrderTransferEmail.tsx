import React from "react"
import { EmailLayout } from "./layout"

export interface OrderTransferEmailProps {
  order_id: string
  token: string
  original_email?: string
  storefront_url?: string
  subject?: string
}

export function OrderTransferEmail(props: OrderTransferEmailProps) {
  const {
    order_id,
    token,
    original_email,
    storefront_url = "https://infinytree.com",
  } = props

  const acceptLink = `${storefront_url}/order/${order_id}/transfer/${token}/accept`
  const declineLink = `${storefront_url}/order/${order_id}/transfer/${token}/decline`

  return (
    <EmailLayout preview="Someone wants to transfer an order to your Infinytree account">
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        Order Transfer Request
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        {original_email
          ? `${original_email} wants to transfer order #${order_id?.slice(-8)} to your Infinytree account.`
          : `Someone wants to transfer order #${order_id?.slice(-8)} to your Infinytree account.`}
      </p>
      <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        Accepting this transfer will add the order to your account, giving you access to
        order history, returns, and support.
      </p>

      {/* Accept / Decline Buttons */}
      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
        <tr>
          <td style={{ paddingRight: "10px", width: "50%" }}>
            <a
              href={acceptLink}
              style={{
                display: "block",
                padding: "14px 24px",
                backgroundColor: "#2d4a3e",
                color: "#ffffff",
                fontSize: "15px",
                textDecoration: "none",
                borderRadius: "4px",
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              Accept Transfer
            </a>
          </td>
          <td style={{ paddingLeft: "10px", width: "50%" }}>
            <a
              href={declineLink}
              style={{
                display: "block",
                padding: "14px 24px",
                backgroundColor: "#ffffff",
                color: "#888",
                fontSize: "15px",
                textDecoration: "none",
                borderRadius: "4px",
                fontWeight: 500,
                border: "1px solid #ccc",
                textAlign: "center",
              }}
            >
              Decline
            </a>
          </td>
        </tr>
      </table>

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        If you weren&apos;t expecting this transfer, you can safely ignore this email.
        Questions? Contact{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
