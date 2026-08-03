import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"

export interface EmailVerificationEmailProps {
  code: string
  entity_id: string
  expires_at?: string
  storefront_url?: string
  subject?: string
  locale?: string
}

export function EmailVerificationEmail(props: EmailVerificationEmailProps) {
  const {
    code,
    entity_id,
    storefront_url = "https://infinytree.com",
    locale = "en",
  } = props

  const t = createTranslator(locale)
  const verifyLink = `${storefront_url}/account/verify?email=${encodeURIComponent(entity_id)}&code=${encodeURIComponent(code)}`

  return (
    <EmailLayout preview={t("email.emailVerification.preview")} locale={locale}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        {t("email.emailVerification.heading")}
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        {t("email.emailVerification.body")}
      </p>

      {/* Verification Code */}
      <table
        cellPadding="0"
        cellSpacing="0"
        border={0}
        width="100%"
        style={{ marginBottom: "24px" }}
      >
        <tr>
          <td align="center">
            <p
              style={{
                display: "inline-block",
                padding: "16px 40px",
                backgroundColor: "#f0f5f2",
                color: "#2d4a3e",
                fontSize: "28px",
                fontWeight: 700,
                borderRadius: "6px",
                margin: 0,
                letterSpacing: "4px",
                fontFamily: "monospace",
              }}
            >
              {code}
            </p>
          </td>
        </tr>
      </table>

      {/* Verify Button */}
      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
        <tr>
          <td align="center">
            <a
              href={verifyLink}
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
              {t("email.emailVerification.verifyButton")}
            </a>
          </td>
        </tr>
      </table>

      <p style={{ fontSize: "13px", color: "#888", margin: "0 0 8px", lineHeight: "1.5" }}>
        {t("email.emailVerification.codeNote")}
      </p>

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        {t("email.emailVerification.ignoreNote")}
      </p>
    </EmailLayout>
  )
}
