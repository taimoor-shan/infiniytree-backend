import { RepInviteEmail } from "../modules/resend/emails/RepInviteEmail"
import { translate } from "../modules/resend/i18n"
import { sendRepEmail } from "../utils/rep-emails"

type InviteSentEvent = {
  invite_id: string
  email: string
  name: string
  /** The secret in the candidate's link */
  token: string
  expires_at: string
  recruiter_name: string
  locale: string | null
}

/**
 * A sales rep invited someone, or sent the invitation again: email the
 * candidate their personal link to apply. Failures are logged, not thrown: the
 * recruiter sees the invite as waiting and can send it again.
 */
export default async function salesRepInviteHandler({
  event,
  container,
}: {
  event: { name: string; data: InviteSentEvent }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const { invite_id, email, name, token, expires_at, recruiter_name } = event.data
  const locale = event.data.locale || "en"

  try {
    await sendRepEmail(container, {
      to: email,
      template: "rep-invite",
      component: RepInviteEmail,
      props: { token, name, recruiter_name, expires_at, locale },
      subject: translate("email.subject.repInvite", locale, { recruiter: recruiter_name }),
      trigger_type: event.name,
      resource_id: invite_id,
      resource_type: "rep_invite",
      log_data: { recruiter_name, locale },
    })
  } catch (error: any) {
    logger.error(`Failed to email sales team invitation ${invite_id}: ${error.message}`)
  }
}

export const config = {
  event: "sales-commission.invite.sent",
}
