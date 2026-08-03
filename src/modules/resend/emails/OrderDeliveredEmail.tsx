import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"

export interface OrderDeliveredEmailProps {
  order_id: string
  display_id?: string | number
  order_url?: string
  storefront_url?: string
  subject?: string
  locale?: string
}

export function OrderDeliveredEmail(props: OrderDeliveredEmailProps) {
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
    <EmailLayout preview={t("email.orderDelivered.preview", { orderNumber })} locale={locale}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        {t("email.orderDelivered.heading")}
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        {t("email.orderDelivered.body1")}
      </p>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        {t("email.orderDelivered.body2")}
      </p>

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
