import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"

export interface ShippingUpdateEmailProps {
  order_id: string
  display_id?: string | number
  tracking_numbers?: string[]
  fulfillment_id?: string
  order_url?: string
  storefront_url?: string
  subject?: string
  locale?: string
}

export function ShippingUpdateEmail(props: ShippingUpdateEmailProps) {
  const {
    display_id,
    tracking_numbers,
    storefront_url = "https://infinytree.com",
    order_id,
    order_url,
    locale = "en",
  } = props

  const t = createTranslator(locale)
  const orderNumber = display_id || order_id?.slice(-8) || "—"

  return (
    <EmailLayout preview={t("email.shippingUpdate.preview", { orderNumber })} locale={locale}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        {t("email.shippingUpdate.heading")}
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        {t("email.shippingUpdate.body", { orderNumber })}
      </p>

      {/* Tracking Numbers */}
      {tracking_numbers && tracking_numbers.length > 0 && (
        <>
          <h3 style={{ fontSize: "16px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
            {t("email.shippingUpdate.trackingLabel")}
          </h3>
          <table
            cellPadding="0"
            cellSpacing="0"
            border={0}
            width="100%"
            style={{ marginBottom: "24px" }}
          >
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

      {!tracking_numbers?.length && (
        <p style={{ fontSize: "14px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
          {t("email.shippingUpdate.noTracking")}
        </p>
      )}

      {/* View Order CTA — only for registered users */}
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
                {t("email.shippingUpdate.trackOrder")}
              </a>
            </td>
          </tr>
        </table>
      ) : null}

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        {t("email.common.questionsAboutShipment")}{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
