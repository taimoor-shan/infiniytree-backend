import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function orderEventsToMake({
  event,
}: SubscriberArgs<{ id: string }>) {
  const webhookUrl = process.env.MAKE_ORDER_WEBHOOK_URL
  if (!webhookUrl) {
    // Not configured (a local or test environment): nothing to send to
    console.log("[Make] MAKE_ORDER_WEBHOOK_URL is not set, skipping", event.name, event.data.id)
    return
  }

  console.log("[Make] Received Medusa event:", event.name, event.data.id)

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": process.env.MAKE_WEBHOOK_SECRET!,
    },
    body: JSON.stringify({
      event: event.name,
      order_id: event.data.id,
    }),
  })

  console.log(
    "[Make] Webhook response:",
    response.status,
    await response.text(),
  )
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled"],
}