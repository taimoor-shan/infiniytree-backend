import { RepApplicationDeclinedEmail } from "../modules/resend/emails/RepApplicationDeclinedEmail"
import { RepRecruitUpdateEmail } from "../modules/resend/emails/RepRecruitUpdateEmail"
import { translate } from "../modules/resend/i18n"
import { sendRepEmail } from "../utils/rep-emails"

type ApplicationDeclinedEvent = {
  invite_id: string
  name: string
  email: string
  recruiter: { name: string; email: string }
  locale: string | null
}

/**
 * The owner declined an application: tell the candidate and the recruiter the
 * outcome. The owner's reason is not part of the event and goes to neither.
 */
export default async function salesApplicationDeclinedHandler({
  event,
  container,
}: {
  event: { name: string; data: ApplicationDeclinedEvent }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const { invite_id, name, email, recruiter } = event.data
  const locale = event.data.locale || "en"

  try {
    await sendRepEmail(container, {
      to: email,
      template: "rep-application-declined",
      component: RepApplicationDeclinedEmail,
      props: { name, locale },
      subject: translate("email.subject.repDeclined", locale),
      trigger_type: event.name,
      resource_id: invite_id,
      resource_type: "rep_invite",
      log_data: { locale },
    })
  } catch (error: any) {
    logger.error(`Failed to email the candidate about application ${invite_id}: ${error.message}`)
  }

  try {
    await sendRepEmail(container, {
      to: recruiter.email,
      template: "rep-recruit-update",
      component: RepRecruitUpdateEmail,
      props: { outcome: "declined", name, recruiter_name: recruiter.name, locale },
      subject: translate("email.subject.repRecruitDeclined", locale, { name }),
      trigger_type: event.name,
      resource_id: invite_id,
      resource_type: "rep_invite",
      log_data: { outcome: "declined", locale },
    })
  } catch (error: any) {
    logger.error(`Failed to tell the recruiter about application ${invite_id}: ${error.message}`)
  }
}

export const config = {
  event: "sales-commission.application.declined",
}
