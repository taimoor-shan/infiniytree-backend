import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"

export interface OrderTransferEmailProps {
  order_id: string
  token: string
  original_email?: string
  storefront_url?: string
  subject?: string
  locale?: string
}

export function OrderTransferEmail(props: OrderTransferEmailProps) {
  const {
    order_id,
    token,
    original_email,
    storefront_url = "https://infinytree.com",
    locale = "en",
  } = props

  const t = createTranslator(locale)
  const orderNumber = order_id?.slice(-8)
  const acceptLink = `${storefront_url}/order/${order_id}/transfer/${token}/accept`
  const declineLink = `${storefront_url}/order/${order_id}/transfer/${token}/decline`

  return (
    <EmailLayout preview={t("email.orderTransfer.preview")} locale={locale}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        {t("email.orderTransfer.heading")}
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        {original_email
          ? t("email.orderTransfer.bodyWithEmail", { email: original_email, orderNumber })
          : t("email.orderTransfer.bodyWithoutEmail", { orderNumber })}
      </p>
      <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        {t("email.orderTransfer.body2")}
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
              {t("email.orderTransfer.accept")}
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
              {t("email.orderTransfer.decline")}
            </a>
          </td>
        </tr>
      </table>

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        {t("email.orderTransfer.ignoreNote")}{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
