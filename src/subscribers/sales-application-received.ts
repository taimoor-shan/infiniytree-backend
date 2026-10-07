import { RepApplicationReceivedEmail } from "../modules/resend/emails/RepApplicationReceivedEmail"
import { translate } from "../modules/resend/i18n"
import { sendRepEmail } from "../utils/rep-emails"

type ApplicationReceivedEvent = {
  invite_id: string
  applicant_name: string
  email: string
  phone: string | null
  company: string | null
  requested_currency_code: string | null
  recruiter_name: string
}

/** Where the owner reviews an application in the admin. */
const reviewUrl = (inviteId: string) =>
  `${process.env.BACKEND_PUBLIC_URL || "http://localhost:9000"}/app/sales-reps/applications/${inviteId}`

/**
 * A candidate applied: tell the owner there is something to review. Goes to
 * SALES_COMMISSION_NOTIFY_EMAIL, else the shop's contact address.
 */
export default async function salesApplicationReceivedHandler({
  event,
  container,
}: {
  event: { name: string; data: ApplicationReceivedEvent }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const { invite_id, applicant_name, recruiter_name } = event.data

  try {
    await sendRepEmail(container, {
      to:
        process.env.SALES_COMMISSION_NOTIFY_EMAIL ||
        process.env.CONTACT_EMAIL ||
        "info@infinytree.com",
      template: "rep-application-received",
      component: RepApplicationReceivedEmail,
      props: {
        applicant_name,
        email: event.data.email,
        phone: event.data.phone,
        company: event.data.company,
        requested_currency_code: event.data.requested_currency_code,
        recruiter_name,
        review_url: reviewUrl(invite_id),
      },
      subject: translate("email.subject.repApplication", "en", { name: applicant_name }),
      trigger_type: event.name,
      resource_id: invite_id,
      resource_type: "rep_invite",
    })
  } catch (error: any) {
    logger.error(`Failed to email the owner about application ${invite_id}: ${error.message}`)
  }
}

export const config = {
  event: "sales-commission.application.received",
}
