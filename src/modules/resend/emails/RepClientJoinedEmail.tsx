import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator, resolveLocale } from "../i18n"
import { CtaButton, greeting, Heading, Paragraph, Questions } from "./rep-parts"

export interface RepClientJoinedEmailProps {
  /** The client who joined through the rep's link: their company or name, never their email */
  client_name: string
  /** Percent the client is credited at */
  rate: number
  /** The rep being told */
  rep_name?: string
  storefront_url?: string
  locale?: string
}

/** 7.5 as "7.5" in English and "7,5" in Hungarian. */
const formatRate = (rate: number, locale?: string) => {
  try {
    return new Intl.NumberFormat(resolveLocale(locale), { maximumFractionDigits: 2 }).format(rate)
  } catch {
    return String(rate)
  }
}

/** Sent to a rep when a new client joins through their client link. */
export function RepClientJoinedEmail(props: RepClientJoinedEmailProps) {
  const { client_name, rate, rep_name, storefront_url = "https://infinytree.com", locale = "en" } = props
  const t = createTranslator(locale)

  return (
    <EmailLayout preview={t("email.repClientJoined.preview", { name: client_name })} locale={locale}>
      <Heading>{t("email.repClientJoined.heading")}</Heading>
      <Paragraph>{greeting(locale, rep_name)}</Paragraph>
      <Paragraph>{t("email.repClientJoined.body", { name: client_name })}</Paragraph>
      <Paragraph>{t("email.repClientJoined.rate", { rate: formatRate(rate, locale) })}</Paragraph>
      <CtaButton href={`${storefront_url}/sales-portal/client-link`}>
        {t("email.repClientJoined.button")}
      </CtaButton>
      <Questions locale={locale} />
    </EmailLayout>
  )
}
