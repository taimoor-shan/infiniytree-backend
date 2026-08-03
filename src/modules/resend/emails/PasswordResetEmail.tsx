import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"

export interface PasswordResetEmailProps {
  token: string
  entity_id: string
  actor_type?: string
  storefront_url?: string
  subject?: string
  locale?: string
}

export function PasswordResetEmail(props: PasswordResetEmailProps) {
  const {
    token,
    entity_id,
    storefront_url = "https://infinytree.com",
    locale = "en",
  } = props

  const t = createTranslator(locale)
  const resetLink = `${storefront_url}/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(entity_id)}`

  return (
    <EmailLayout preview={t("email.passwordReset.preview")} locale={locale}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        {t("email.passwordReset.heading")}
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        {t("email.passwordReset.body")}
      </p>

      {/* Reset Button */}
      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
        <tr>
          <td align="center">
            <a
              href={resetLink}
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
              {t("email.passwordReset.resetButton")}
            </a>
          </td>
        </tr>
      </table>

      <p style={{ fontSize: "14px", color: "#555", margin: "0 0 8px", lineHeight: "1.6" }}>
        {t("email.passwordReset.orPaste")}
      </p>
      <p
        style={{
          fontSize: "13px",
          color: "#2d4a3e",
          margin: "0 0 24px",
          lineHeight: "1.6",
          wordBreak: "break-all",
        }}
      >
        {resetLink}
      </p>

      <p style={{ fontSize: "13px", color: "#888", margin: "0 0 8px", lineHeight: "1.5" }}>
        {t("email.passwordReset.ignoreNote")}
      </p>

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        {t("email.common.questionsReachOut")}{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
