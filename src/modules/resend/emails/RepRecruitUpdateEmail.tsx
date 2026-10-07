import React from "react"
import { EmailLayout } from "./layout"
import { createTranslator } from "../i18n"
import { CtaButton, greeting, Heading, Paragraph, Questions } from "./rep-parts"

export interface RepRecruitUpdateEmailProps {
  /** What the owner decided about the recruit's application */
  outcome: "approved" | "declined"
  /** The recruit */
  name: string
  /** The recruiter being told */
  recruiter_name?: string
  storefront_url?: string
  locale?: string
}

/** Sent to a rep who invited someone, when the owner has decided on their application. */
export function RepRecruitUpdateEmail(props: RepRecruitUpdateEmailProps) {
  const {
    outcome,
    name,
    recruiter_name,
    storefront_url = "https://infinytree.com",
    locale = "en",
  } = props
  const t = createTranslator(locale)
  const key = outcome === "approved" ? "email.repRecruitUpdate.approved" : "email.repRecruitUpdate.declined"

  return (
    <EmailLayout preview={t(`${key}.preview`, { name })} locale={locale}>
      <Heading>{t(`${key}.heading`, { name })}</Heading>
      <Paragraph>{greeting(locale, recruiter_name)}</Paragraph>
      <Paragraph>{t(`${key}.body`, { name })}</Paragraph>
      <CtaButton href={`${storefront_url}/sales-portal/recruits`}>
        {t("email.repRecruitUpdate.button")}
      </CtaButton>
      <Questions locale={locale} />
    </EmailLayout>
  )
}
