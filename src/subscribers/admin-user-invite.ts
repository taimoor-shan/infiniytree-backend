import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AdminInviteEmail } from "../modules/resend/emails/AdminInviteEmail"
import { translate } from "../modules/resend/i18n"
import { sendRepEmail } from "../utils/rep-emails"

type InviteEvent = {
  id: string
}

/** An invite holds only an email address, so there is no language to write in. */
const LOCALE = "en"

/** The admin's own invite page, which reads the token from the link. */
const inviteUrl = (adminPath: string, token: string) => {
  const backendUrl = (process.env.BACKEND_PUBLIC_URL || "http://localhost:9000").replace(/\/+$/, "")

  return `${backendUrl}${adminPath}/invite?token=${encodeURIComponent(token)}`
}

/**
 * An admin invited someone, or sent the invitation again: email the invitee
 * their link to the admin. Medusa only emits these events; it sends nothing
 * itself. Failures are logged, not thrown: the admin sees the invite as
 * waiting under Settings > Users and can resend it.
 *
 * The email goes out as finished HTML (see `sendRepEmail`): the token in the
 * link lets whoever holds it create an admin account, so it shouldn't sit in
 * the notification log.
 */
export default async function adminUserInviteHandler({
  event,
  container,
}: {
  event: { name: string; data: InviteEvent }
  container: any
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const { id } = event.data

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const configModule = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)

    // The event carries only the id, so a resent invite gets its refreshed token
    const {
      data: [invite],
    } = await query.graph({
      entity: "invite",
      fields: ["id", "email", "token", "expires_at", "accepted"],
      filters: { id },
    })

    // Deleted or accepted before the event was handled: nothing to send
    if (!invite || invite.accepted) {
      return
    }

    await sendRepEmail(container, {
      to: invite.email,
      template: "admin-invite",
      component: AdminInviteEmail,
      props: {
        invite_url: inviteUrl(configModule.admin?.path || "/app", invite.token),
        expires_at: invite.expires_at,
        locale: LOCALE,
      },
      subject: translate("email.subject.adminInvite", LOCALE),
      trigger_type: event.name,
      resource_id: invite.id,
      resource_type: "invite",
    })
  } catch (error: any) {
    logger.error(`Failed to email admin invitation ${id}: ${error.message}`)
  }
}

export const config = {
  event: ["invite.created", "invite.resent"],
}
