import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"

export interface OrderInProgressEmailProps {
  order_id: string
  display_id?: string | number
  order_url?: string
  storefront_url?: string
  subject?: string
  locale?: string
}

export function OrderInProgressEmail(props: OrderInProgressEmailProps) {
  const {
    display_id,
    storefront_url = "https://infinytree.com",
    order_id,
    order_url,
    locale = "en",
  } = props

  const t = createTranslator(locale)
  const orderNumber = display_id || order_id?.slice(-8) || "—"

  return (
    <EmailLayout preview={t("email.orderInProgress.preview", { orderNumber })} locale={locale}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        {t("email.orderInProgress.heading")}
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        {t("email.orderInProgress.body1")}
      </p>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        {t("email.orderInProgress.body2")}
      </p>

      {order_url ? (
        <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
          <tr>
            <td align="center">
              <a
                href={order_url}
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
                {t("email.orderInProgress.viewStatus")}
              </a>
            </td>
          </tr>
        </table>
      ) : (
        <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
          {t("email.orderInProgress.noUpdates")}
        </p>
      )}

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        {t("email.common.questions")}{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
