import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator, resolveLocale } from "../i18n"
import { CtaButton, formatDay, greeting, Heading, Muted, Paragraph, PastedLink, Questions } from "./rep-parts"

export interface RepInviteEmailProps {
  /** The secret in the candidate's personal link */
  token: string
  name?: string
  recruiter_name: string
  expires_at: string
  storefront_url?: string
  locale?: string
}

/**
 * The link in an invite email: the candidate's personal page in the sales
 * portal, which opens in the language of the email (`lang`).
 */
export const repInviteLink = (storefrontUrl: string, token: string, locale?: string) =>
  `${storefrontUrl}/sales-portal/join/${encodeURIComponent(token)}?lang=${resolveLocale(locale)}`

/** Sent to someone a sales rep invited. The link is theirs alone and applies once. */
export function RepInviteEmail(props: RepInviteEmailProps) {
  const {
    token,
    name,
    recruiter_name,
    expires_at,
    storefront_url = "https://infinytree.com",
    locale = "en",
  } = props
  const t = createTranslator(locale)
  const link = repInviteLink(storefront_url, token, locale)

  return (
    <EmailLayout preview={t("email.repInvite.preview", { recruiter: recruiter_name })} locale={locale}>
      <Heading>{t("email.repInvite.heading")}</Heading>
      <Paragraph>{greeting(locale, name)}</Paragraph>
      <Paragraph>{t("email.repInvite.body", { recruiter: recruiter_name })}</Paragraph>
      <Paragraph>{t("email.repInvite.review")}</Paragraph>
      <CtaButton href={link}>{t("email.repInvite.button")}</CtaButton>
      <PastedLink href={link} locale={locale} />
      <Muted>{t("email.repInvite.expires", { date: formatDay(expires_at, locale) })}</Muted>
      <Muted>{t("email.repInvite.ignore")}</Muted>
      <Questions locale={locale} />
    </EmailLayout>
  )
}
