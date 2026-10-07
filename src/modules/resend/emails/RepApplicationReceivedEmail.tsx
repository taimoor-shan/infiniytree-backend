import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"
import { CtaButton, Heading, Paragraph } from "./rep-parts"

export interface RepApplicationReceivedEmailProps {
  applicant_name: string
  email: string
  phone?: string | null
  company?: string | null
  requested_currency_code?: string | null
  recruiter_name: string
  /** Where the owner reviews it, in the admin */
  review_url: string
  storefront_url?: string
  locale?: string
}

/** Sent to the owner when a candidate applies: the facts, and a button to the review screen. */
export function RepApplicationReceivedEmail(props: RepApplicationReceivedEmailProps) {
  const { applicant_name, email, phone, company, requested_currency_code, recruiter_name, review_url } = props
  // For the owner, in the language of the admin
  const t = createTranslator("en")

  const rows: [string, string | null | undefined][] = [
    [t("email.repApplication.name"), applicant_name],
    [t("email.repApplication.email"), email],
    [t("email.repApplication.phone"), phone],
    [t("email.repApplication.company"), company],
    [t("email.repApplication.currency"), requested_currency_code?.toUpperCase()],
    [t("email.repApplication.recruiter"), recruiter_name],
  ]

  return (
    <EmailLayout preview={t("email.repApplication.preview", { name: applicant_name })} locale="en">
      <Heading>{t("email.repApplication.heading", { name: applicant_name })}</Heading>
      <Paragraph>{t("email.repApplication.body", { recruiter: recruiter_name })}</Paragraph>
      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ margin: "0 0 16px" }}>
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <tr key={label}>
              <td style={{ padding: "4px 12px 4px 0", fontSize: "14px", color: "#888", width: "140px" }}>
                {label}
              </td>
              <td style={{ padding: "4px 0", fontSize: "14px", color: "#333" }}>{value}</td>
            </tr>
          ))}
      </table>
      <CtaButton href={review_url}>{t("email.repApplication.button")}</CtaButton>
    </EmailLayout>
  )
}
