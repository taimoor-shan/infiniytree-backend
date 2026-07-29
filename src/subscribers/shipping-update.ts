import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService, IFulfillmentModuleService } from "@medusajs/framework/types"

interface ShipmentCreatedEventData {
  id: string
  no_notification?: boolean
}

export default async function shipmentCreatedHandler({
  event,
  container,
}: {
  event: { name: string; data: ShipmentCreatedEventData }
  container: any
}) {
  // Respect the no_notification flag
  if (event.data.no_notification) {
    return
  }

  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any
  const fulfillmentModule: IFulfillmentModuleService = container.resolve(
    Modules.FULFILLMENT
  )
  const orderModule: IOrderModuleService = container.resolve(Modules.ORDER)

  try {
    // Fetch fulfillment to get the order_id
    const fulfillment = await fulfillmentModule.retrieveFulfillment(
      event.data.id,
      { relations: ["items", "labels"] }
    )

    // Fetch the order to get customer email
    const order = await orderModule.retrieveOrder(
      (fulfillment as any).order_id,
      { relations: ["items"] }
    )

    const trackingNumbers = ((fulfillment as any).labels || [])
      .filter((l: any) => l.tracking_number)
      .map((l: any) => l.tracking_number)

    await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "shipping-update",
      data: {
        order_id: order.id,
        display_id: (order as any).display_id,
        tracking_numbers: trackingNumbers,
        fulfillment_id: fulfillment.id,
      },
      trigger_type: "shipment.created",
      resource_id: order.id,
      resource_type: "order",
    })
  } catch (error: any) {
    logger.error(
      `Failed to send shipping notification: ${error.message}`
    )
  }
}

export const config = {
  event: "shipment.created",
}
