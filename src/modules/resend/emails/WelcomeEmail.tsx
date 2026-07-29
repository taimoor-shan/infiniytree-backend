import React from "react"
import { EmailLayout } from "./layout"

export interface WelcomeEmailProps {
  first_name?: string
  email?: string
  storefront_url?: string
  subject?: string
}

export function WelcomeEmail(props: WelcomeEmailProps) {
  const { first_name, storefront_url = "https://infinytree.com" } = props
  const name = first_name || "there"

  return (
    <EmailLayout preview={`Welcome to Infinytree, ${name}! 🌱`}>
      <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
        Welcome to Infinytree, {name}! 🌱
      </h2>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
        We&apos;re thrilled to have you join our community of plant lovers. At Infinytree,
        we craft beautiful artificial plants that bring the warmth of nature into your
        home — without the maintenance.
      </p>
      <p style={{ fontSize: "15px", color: "#555", margin: "0 0 24px", lineHeight: "1.6" }}>
        Handmade with care, each piece is designed to look as natural as the real thing,
        lasting forever with zero watering, zero sunlight, and zero fuss.
      </p>

      {/* CTAs */}
      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ marginBottom: "24px" }}>
        <tr>
          <td style={{ paddingRight: "12px" }}>
            <a
              href={`${storefront_url}/collections`}
              style={{
                display: "inline-block",
                padding: "12px 28px",
                backgroundColor: "#2d4a3e",
                color: "#ffffff",
                fontSize: "14px",
                textDecoration: "none",
                borderRadius: "4px",
                fontWeight: 500,
                textAlign: "center",
                width: "100%",
              }}
            >
              Browse Collections
            </a>
          </td>
          <td style={{ paddingLeft: "12px" }}>
            <a
              href={`${storefront_url}/account`}
              style={{
                display: "inline-block",
                padding: "12px 28px",
                backgroundColor: "#ffffff",
                color: "#2d4a3e",
                fontSize: "14px",
                textDecoration: "none",
                borderRadius: "4px",
                fontWeight: 500,
                border: "1px solid #2d4a3e",
                textAlign: "center",
                width: "100%",
              }}
            >
              Your Account
            </a>
          </td>
        </tr>
      </table>

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
