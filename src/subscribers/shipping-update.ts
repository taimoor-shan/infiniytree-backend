import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { IOrderModuleService, IFulfillmentModuleService } from "@medusajs/framework/types"
import { buildOrderAccessUrl } from "../utils/order-url"

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
  if (event.data.no_notification) {
    return
  }

  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const fulfillmentModule: IFulfillmentModuleService = container.resolve(
    Modules.FULFILLMENT
  )
  const orderModule: IOrderModuleService = container.resolve(Modules.ORDER)

  try {
    logger.info(`[shipping-update] Event received for fulfillment ${event.data.id}, no_notification=${event.data.no_notification}`)

    // event.data.id is the fulfillment ID (from createShipmentWorkflow)
    const fulfillment = await fulfillmentModule.retrieveFulfillment(
      event.data.id,
      { relations: ["labels"] }
    )

    logger.info(`[shipping-update] Fulfillment retrieved: id=${fulfillment.id}, labels=${(fulfillment as any).labels?.length || 0}`)

    // Find the order linked to this fulfillment via the link table
    const { data: [linkEntry] } = await query.graph({
      entity: "order_fulfillment",
      fields: ["order_id"],
      filters: {
        fulfillment_id: event.data.id,
      },
    })

    logger.info(`[shipping-update] Link query result: ${JSON.stringify(linkEntry || null)}`)

    if (!linkEntry) {
      logger.error(`[shipping-update] No order link found for fulfillment ${event.data.id}`)
      return
    }

    const order = await orderModule.retrieveOrder(linkEntry.order_id)

    logger.info(`[shipping-update] Order retrieved: id=${order.id}, email=${order.email || "MISSING"}, display_id=${(order as any).display_id || "MISSING"}`)

    const trackingNumbers = ((fulfillment as any).labels || [])
      .filter((l: any) => l.tracking_number)
      .map((l: any) => l.tracking_number)

    const trackingUrl = ((fulfillment as any).labels || [])
      .find((l: any) => l.tracking_url)?.tracking_url

    if (!order.email) {
      logger.warn(`[shipping-update] Order ${order.id} has no email — skipping`)
      return
    }

    const orderMeta = ((order as any).metadata || {}) as Record<string, unknown>
    const storefrontUrl = process.env.STOREFRONT_PUBLIC_URL || "https://infinytree.com"
    const orderUrl = await buildOrderAccessUrl(
      {
        id: order.id,
        display_id: (order as any).display_id,
        customer_id: (order as any).customer_id,
        metadata: orderMeta,
      },
      storefrontUrl,
      container
    )

    await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-shipped",
      data: {
        order_id: order.id,
        display_id: (order as any).display_id,
        tracking_numbers: trackingNumbers,
        tracking_url: trackingUrl,
        fulfillment_id: fulfillment.id,
        order_url: orderUrl,
      },
      trigger_type: "shipment.created",
      resource_id: order.id,
      resource_type: "order",
    })

    logger.info(`[shipping-update] Shipping notification sent to ${order.email}`)
  } catch (error: any) {
    logger.error(
      `[shipping-update] Failed for fulfillment ${event.data.id}: ${error.message}`
    )
  }
}

export const config = {
  event: "shipment.created",
}
