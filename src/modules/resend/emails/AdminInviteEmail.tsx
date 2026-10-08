import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator, resolveLocale } from "../i18n"
import { CtaButton, Heading, Muted, Paragraph, PastedLink, Questions } from "./rep-parts"

export interface AdminInviteEmailProps {
  /** The admin's accept page; the secret invite token is in the link */
  invite_url: string
  expires_at: string | Date
  locale?: string
}

/**
 * The moment the invitation stops working, in the shop's time zone and with
 * the zone's name so a reader elsewhere isn't left guessing. An invitation
 * works for a day unless the user module is set otherwise, so a date alone
 * would be vague.
 */
const formatDeadline = (expiresAt: string | Date, locale?: string): string => {
  try {
    return new Intl.DateTimeFormat(resolveLocale(locale), {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Europe/Budapest",
      timeZoneName: "short",
    }).format(new Date(expiresAt))
  } catch {
    return String(expiresAt)
  }
}

/** Sent to someone an admin invited to the Infinytree admin. The link is theirs alone. */
export function AdminInviteEmail(props: AdminInviteEmailProps) {
  const { invite_url, expires_at, locale = "en" } = props
  const t = createTranslator(locale)

  return (
    <EmailLayout preview={t("email.adminInvite.preview")} locale={locale}>
      <Heading>{t("email.adminInvite.heading")}</Heading>
      <Paragraph>{t("email.adminInvite.body")}</Paragraph>
      <CtaButton href={invite_url}>{t("email.adminInvite.button")}</CtaButton>
      <PastedLink href={invite_url} locale={locale} />
      <Muted>{t("email.adminInvite.expires", { date: formatDeadline(expires_at, locale) })}</Muted>
      <Muted>{t("email.adminInvite.ignore")}</Muted>
      <Questions locale={locale} />
    </EmailLayout>
  )
}
