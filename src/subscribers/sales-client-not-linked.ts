import { OwnerClientLinkEmail } from "../modules/resend/emails/OwnerClientLinkEmail"
import { translate } from "../modules/resend/i18n"
import { sendRepEmail } from "../utils/rep-emails"
import { adminCustomerUrl, ownerNotifyAddress } from "../utils/sales-owner"

type ClientNotLinkedEvent = {
  claim_id: string
  customer_id: string
  client_name: string
  client_email: string
  sales_rep_id: string
  rep_name: string
  outcome: "no_rate" | "rep_inactive" | "own_account"
}

/**
 * A new client followed a rep's client link but could not be linked to them,
 * though they should have been: tell the owner why and what to do. The rep is
 * not told, since the owner may fix it (a rate) before it is worth a word.
 */
export default async function salesClientNotLinkedHandler({
  event,
  container,
}: {
  event: { name: string; data: ClientNotLinkedEvent }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const { claim_id, customer_id, client_name, client_email, rep_name, outcome } = event.data

  try {
    await sendRepEmail(container, {
      to: ownerNotifyAddress(),
      template: "owner-client-not-linked",
      component: OwnerClientLinkEmail,
      props: {
        outcome,
        client_name,
        client_email,
        rep_name,
        customer_url: adminCustomerUrl(customer_id),
      },
      subject: translate("email.subject.ownerClientNotLinked", "en", { rep: rep_name, name: client_name }),
      trigger_type: event.name,
      resource_id: claim_id,
      resource_type: "link_claim",
      log_data: { outcome },
    })
  } catch (error: any) {
    logger.error(`Failed to tell the owner about a client who was not linked (claim ${claim_id}): ${error.message}`)
  }
}

export const config = {
  event: "sales-commission.client.not_linked",
}
