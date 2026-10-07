import { RepRecruitUpdateEmail } from "../modules/resend/emails/RepRecruitUpdateEmail"
import { RepWelcomeEmail } from "../modules/resend/emails/RepWelcomeEmail"
import { translate } from "../modules/resend/i18n"
import { sendRepEmail } from "../utils/rep-emails"

type ApplicationApprovedEvent = {
  invite_id: string
  sales_rep_id: string
  name: string
  email: string
  /** A password-setting link token for the new rep, good for a week */
  token: string
  recruiter: { name: string; email: string }
  locale: string | null
}

/**
 * The owner approved an application: welcome the new rep with a link to set
 * their password, and tell the recruiter. One failing doesn't stop the other.
 */
export default async function salesApplicationApprovedHandler({
  event,
  container,
}: {
  event: { name: string; data: ApplicationApprovedEvent }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const { invite_id, sales_rep_id, name, email, token, recruiter } = event.data
  const locale = event.data.locale || "en"

  try {
    await sendRepEmail(container, {
      to: email,
      template: "rep-welcome",
      component: RepWelcomeEmail,
      props: { token, email, name, recruiter_name: recruiter.name, locale },
      subject: translate("email.subject.repWelcome", locale),
      trigger_type: event.name,
      resource_id: sales_rep_id,
      resource_type: "sales_rep",
      log_data: { locale },
    })
  } catch (error: any) {
    logger.error(`Failed to email the welcome to sales rep ${sales_rep_id}: ${error.message}`)
  }

  try {
    await sendRepEmail(container, {
      to: recruiter.email,
      template: "rep-recruit-update",
      component: RepRecruitUpdateEmail,
      props: { outcome: "approved", name, recruiter_name: recruiter.name, locale },
      subject: translate("email.subject.repRecruitApproved", locale, { name }),
      trigger_type: event.name,
      resource_id: invite_id,
      resource_type: "rep_invite",
      log_data: { outcome: "approved", locale },
    })
  } catch (error: any) {
    logger.error(`Failed to tell the recruiter about application ${invite_id}: ${error.message}`)
  }
}

export const config = {
  event: "sales-commission.application.approved",
}
