import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { generateAccessToken, buildOrderAccessUrl } from "../utils/order-url"

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
  const storefrontUrl = process.env.STOREFRONT_PUBLIC_URL || "https://infinytree.com"

  try {
    const order = await orderModule.retrieveOrder(event.data.order_id, {
      relations: ["items"],
    })

    if (!order.email) {
      logger.warn(`[fulfillment-created] Order ${order.id} has no email — skipping`)
      return
    }

    const orderMeta = ((order as any).metadata || {}) as Record<string, unknown>

    // Lazy-generate token for legacy orders
    if (!orderMeta.order_access_token) {
      const { rawToken, tokenHash } = generateAccessToken()
      try {
        await orderModule.updateOrders(order.id, {
          metadata: { ...orderMeta, order_access_token: rawToken, order_access_token_hash: tokenHash },
        })
        orderMeta.order_access_token = rawToken
        orderMeta.order_access_token_hash = tokenHash
        logger.info(`[fulfillment-created] Lazy-generated access token for legacy order ${order.id}`)
      } catch (err: any) {
        logger.warn(`[fulfillment-created] Failed to lazy-generate token for ${order.id}: ${err.message}`)
      }
    }

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
      template: "order-in-progress",
      data: {
        order_id: order.id,
        display_id: (order as any).display_id,
        fulfillment_id: event.data.fulfillment_id,
        order_url: orderUrl,
        locale: (order as any)?.locale || "en",
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
