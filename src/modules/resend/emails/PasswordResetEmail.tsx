import React from "react"
import { EmailLayout } from "./layout"

export interface PasswordResetEmailProps {
  token: string
  entity_id: string
  actor_type?: string
  storefront_url?: string
  subject?: string
}

export function PasswordResetEmail(props: PasswordResetEmailProps) {
  const {
    token,
    entity_id,
    storefront_url = "https://infinytree.com",
  } = props

  const resetLink = `${storefront_url}/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(entity_id)}`

  return (
    <EmailLayout preview="Reset your Infinytree password">
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        Reset Your Password
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        We received a request to reset the password for your Infinytree account. Click the
        button below to create a new password:
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
              Reset Password
            </a>
          </td>
        </tr>
      </table>

      <p style={{ fontSize: "14px", color: "#555", margin: "0 0 8px", lineHeight: "1.6" }}>
        Or copy and paste this link into your browser:
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
        If you didn&apos;t request a password reset, you can safely ignore this email.
        The link will expire after 24 hours.
      </p>

      <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
        Questions? Reach out at{" "}
        <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
          info@infinytree.com
        </a>
        .
      </p>
    </EmailLayout>
  )
}
