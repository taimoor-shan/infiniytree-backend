import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import React from "react"
import { renderToString } from "react-dom/server"

type RepEmail = {
  to: string
  /** Recorded in the notification log; the email itself is rendered here */
  template: string
  component: React.ComponentType<any>
  props: Record<string, unknown>
  subject: string
  trigger_type: string
  resource_id?: string
  resource_type?: string
  /** What the notification log keeps about the email. Never a secret link token */
  log_data?: Record<string, unknown>
}

/**
 * Sends a sales-team email. The email is rendered here and handed over as
 * finished HTML, not as a template with data: the notification log keeps a
 * notification's data, and these emails carry link tokens that stay valid for
 * days, which shouldn't sit readable in the database or the admin's
 * notification list.
 */
export const sendRepEmail = async (container: MedusaContainer, mail: RepEmail) => {
  const html = renderToString(
    React.createElement(mail.component, {
      ...mail.props,
      storefront_url: process.env.STOREFRONT_PUBLIC_URL,
    })
  )

  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: mail.to,
    channel: "email",
    template: mail.template,
    data: mail.log_data ?? null,
    content: { subject: mail.subject, html },
    trigger_type: mail.trigger_type,
    resource_id: mail.resource_id,
    resource_type: mail.resource_type,
  })
}
