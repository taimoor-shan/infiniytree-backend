import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"
import { passwordResetLink } from "../../../utils/password-reset-link"
import { CtaButton, greeting, Heading, Muted, Paragraph, PastedLink, Questions } from "./rep-parts"

export interface RepWelcomeEmailProps {
  /** A password-setting link token, good for a week */
  token: string
  /** The rep's email, which is also their sign-in */
  email: string
  name?: string
  recruiter_name?: string
  storefront_url?: string
  locale?: string
}

/** Sent to a new sales rep once the owner approved them: set a password to get in. */
export function RepWelcomeEmail(props: RepWelcomeEmailProps) {
  const {
    token,
    email,
    name,
    recruiter_name,
    storefront_url = "https://infinytree.com",
    locale = "en",
  } = props
  const t = createTranslator(locale)
  const link = passwordResetLink({
    storefront_url,
    actor_type: "sales_rep",
    token,
    email,
  })

  return (
    <EmailLayout preview={t("email.repWelcome.preview")} locale={locale}>
      <Heading>{t("email.repWelcome.heading")}</Heading>
      <Paragraph>{greeting(locale, name)}</Paragraph>
      <Paragraph>{t("email.repWelcome.body")}</Paragraph>
      {recruiter_name ? (
        <Paragraph>{t("email.repWelcome.recruiter", { recruiter: recruiter_name })}</Paragraph>
      ) : null}
      <Paragraph>{t("email.repWelcome.setPassword", { email })}</Paragraph>
      <CtaButton href={link}>{t("email.repWelcome.button")}</CtaButton>
      <PastedLink href={link} locale={locale} />
      <Muted>{t("email.repWelcome.expires")}</Muted>
      <Questions locale={locale} />
    </EmailLayout>
  )
}
