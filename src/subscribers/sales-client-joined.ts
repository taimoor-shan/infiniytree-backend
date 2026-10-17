import { OwnerClientLinkEmail } from "../modules/resend/emails/OwnerClientLinkEmail"
import { RepClientJoinedEmail } from "../modules/resend/emails/RepClientJoinedEmail"
import { translate } from "../modules/resend/i18n"
import { sendRepEmail } from "../utils/rep-emails"
import { adminCustomerUrl, ownerNotifyAddress } from "../utils/sales-owner"

type ClientJoinedEvent = {
  claim_id: string
  customer_id: string
  client_name: string
  client_email: string
  sales_rep_id: string
  rep_name: string
  rep_email: string
  rate: number
  locale: string | null
}

/**
 * A new client came through a rep's client link and was linked to them: tell
 * the rep (in their portal's language, with the client's name but not their
 * email) and the owner. Each is tried on its own and failures are logged, not
 * thrown: the client is linked either way, and shows in the rep's portal.
 */
export default async function salesClientJoinedHandler({
  event,
  container,
}: {
  event: { name: string; data: ClientJoinedEvent }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const { claim_id, customer_id, client_name, client_email, rep_name, rep_email, rate } = event.data
  const locale = event.data.locale || "en"

  try {
    await sendRepEmail(container, {
      to: rep_email,
      template: "rep-client-joined",
      component: RepClientJoinedEmail,
      props: { client_name, rate, rep_name, locale },
      subject: translate("email.subject.repClientJoined", locale, { name: client_name }),
      trigger_type: event.name,
      resource_id: claim_id,
      resource_type: "link_claim",
      log_data: { locale },
    })
  } catch (error: any) {
    logger.error(`Failed to tell rep ${rep_name} about the client who joined (claim ${claim_id}): ${error.message}`)
  }

  try {
    await sendRepEmail(container, {
      to: ownerNotifyAddress(),
      template: "owner-client-joined",
      component: OwnerClientLinkEmail,
      props: {
        outcome: "joined",
        client_name,
        client_email,
        rep_name,
        rate,
        customer_url: adminCustomerUrl(customer_id),
      },
      subject: translate("email.subject.ownerClientJoined", "en", { rep: rep_name, name: client_name }),
      trigger_type: event.name,
      resource_id: claim_id,
      resource_type: "link_claim",
    })
  } catch (error: any) {
    logger.error(`Failed to tell the owner about the client who joined (claim ${claim_id}): ${error.message}`)
  }
}

export const config = {
  event: "sales-commission.client.joined",
}
