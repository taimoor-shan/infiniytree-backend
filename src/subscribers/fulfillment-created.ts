import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

interface FulfillmentCreatedEventData {
  order_id: string
  fulfillment_id: string
  no_notification?: boolean
}

export default async function fulfillmentCreatedHandler({
  event,
  container,
}: {
  event: { name: string; data: FulfillmentCreatedEventData }
  container: any
}) {
  if (event.data.no_notification) {
    return
  }

  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any
  const orderModule: IOrderModuleService = container.resolve(Modules.ORDER)

  try {
    const order = await orderModule.retrieveOrder(event.data.order_id, {
      relations: ["items"],
    })

    if (!order.email) {
      logger.warn(`[fulfillment-created] Order ${order.id} has no email — skipping`)
      return
    }

    await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-in-progress",
      data: {
        order_id: order.id,
        display_id: (order as any).display_id,
        fulfillment_id: event.data.fulfillment_id,
      },
      trigger_type: "order.fulfillment_created",
      resource_id: order.id,
      resource_type: "order",
    })

    logger.info(`[fulfillment-created] Notification sent to ${order.email}`)
  } catch (error: any) {
    logger.error(
      `[fulfillment-created] Failed for order ${event.data.order_id}: ${error.message}`
    )
  }
}

export const config = {
  event: "order.fulfillment_created",
}
