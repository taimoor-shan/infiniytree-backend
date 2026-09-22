import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function orderEventsToMake({
  event,
}: SubscriberArgs<{ id: string }>) {
  await fetch(process.env.MAKE_ORDER_WEBHOOK_URL!, {
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
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled"],
}