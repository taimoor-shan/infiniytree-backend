import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"
import { greeting, Heading, Paragraph, Questions } from "./rep-parts"

export interface RepApplicationDeclinedEmailProps {
  name?: string
  storefront_url?: string
  locale?: string
}

/** Sent to a candidate whose application was declined. It gives the outcome, not the reason. */
export function RepApplicationDeclinedEmail(props: RepApplicationDeclinedEmailProps) {
  const { name, locale = "en" } = props
  const t = createTranslator(locale)

  return (
    <EmailLayout preview={t("email.repDeclined.preview")} locale={locale}>
      <Heading>{t("email.repDeclined.heading")}</Heading>
      <Paragraph>{greeting(locale, name)}</Paragraph>
      <Paragraph>{t("email.repDeclined.body")}</Paragraph>
      <Paragraph>{t("email.repDeclined.thanks")}</Paragraph>
      <Questions locale={locale} />
    </EmailLayout>
  )
}
