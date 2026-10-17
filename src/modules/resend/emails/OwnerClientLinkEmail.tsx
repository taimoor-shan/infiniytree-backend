import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"
import { CtaButton, Heading, Paragraph } from "./rep-parts"

export interface OwnerClientLinkEmailProps {
  /** Linked to the rep, or why not */
  outcome: "joined" | "no_rate" | "rep_inactive" | "own_account"
  client_name: string
  client_email: string
  rep_name: string
  /** Percent the client is credited at; only when linked */
  rate?: number
  /** Where the owner opens the customer, in the admin */
  customer_url: string
  storefront_url?: string
}

/**
 * Sent to the owner when a client came through a rep's client link: linked, or
 * not linked though they should have been, with the reason and what to do.
 */
export function OwnerClientLinkEmail(props: OwnerClientLinkEmailProps) {
  const { outcome, client_name, client_email, rep_name, rate, customer_url } = props
  // For the owner, in the language of the admin
  const t = createTranslator("en")
  const params = { name: client_name, rep: rep_name, rate: rate ?? "" }
  const key = outcome === "joined" ? "email.ownerClient.joined" : "email.ownerClient.notLinked"

  const rows: [string, string][] = [
    [t("email.ownerClient.client"), client_name],
    [t("email.ownerClient.email"), client_email],
    [t("email.ownerClient.rep"), rep_name],
    ...(outcome === "joined" && rate !== undefined
      ? ([[t("email.ownerClient.rate"), `${rate}%`]] as [string, string][])
      : []),
  ]

  return (
    <EmailLayout preview={t(`${key}.preview`, params)} locale="en">
      <Heading>{t(`${key}.heading`, params)}</Heading>
      <Paragraph>{t(`${key}.body`, params)}</Paragraph>
      {outcome !== "joined" && <Paragraph>{t(`email.ownerClient.reason.${outcome}`, params)}</Paragraph>}
      <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ margin: "0 0 16px" }}>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={{ padding: "4px 12px 4px 0", fontSize: "14px", color: "#888", width: "140px" }}>
              {label}
            </td>
            <td style={{ padding: "4px 0", fontSize: "14px", color: "#333" }}>{value}</td>
          </tr>
        ))}
      </table>
      <CtaButton href={customer_url}>{t("email.ownerClient.button")}</CtaButton>
    </EmailLayout>
  )
}
