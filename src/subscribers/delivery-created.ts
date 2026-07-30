import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

interface DeliveryCreatedEventData {
  id: string
  no_notification?: boolean
}

export default async function deliveryCreatedHandler({
  event,
  container,
}: {
  event: { name: string; data: DeliveryCreatedEventData }
  container: any
}) {
  if (event.data.no_notification) {
    return
  }

  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const orderModule: IOrderModuleService = container.resolve(Modules.ORDER)

  try {
    logger.info(`[delivery-created] Event received for fulfillment ${event.data.id}, no_notification=${event.data.no_notification}`)

    // Find the order linked to this fulfillment via the link table
    const { data: [linkEntry] } = await query.graph({
      entity: "order_fulfillment",
      fields: ["order_id"],
      filters: {
        fulfillment_id: event.data.id,
      },
    })

    logger.info(`[delivery-created] Link query result: ${JSON.stringify(linkEntry || null)}`)

    if (!linkEntry) {
      logger.error(`[delivery-created] No order link found for fulfillment ${event.data.id}`)
      return
    }

    const order = await orderModule.retrieveOrder(linkEntry.order_id)

    logger.info(`[delivery-created] Order retrieved: id=${order.id}, email=${order.email || "MISSING"}, display_id=${(order as any).display_id || "MISSING"}`)

    if (!order.email) {
      logger.warn(`[delivery-created] Order ${order.id} has no email — skipping`)
      return
    }

    await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-delivered",
      data: {
        order_id: order.id,
        display_id: (order as any).display_id,
        fulfillment_id: event.data.id,
      },
      trigger_type: "delivery.created",
      resource_id: order.id,
      resource_type: "order",
    })

    logger.info(`[delivery-created] Notification sent to ${order.email}`)
  } catch (error: any) {
    logger.error(
      `[delivery-created] Failed for fulfillment ${event.data.id}: ${error.message}`
    )
  }
}

export const config = {
  event: "delivery.created",
}
