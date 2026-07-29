import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

export default async function orderPlacedHandler({
  event,
  container,
}: {
  event: { name: string; data: { id: string } }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any
  const orderService: IOrderModuleService = container.resolve(Modules.ORDER)

  try {
    const order = await orderService.retrieveOrder(event.data.id, {
      relations: [
        "items",
        "items.variant",
        "items.variant.product",
        "shipping_address",
        "payment_collections",
        "payment_collections.payments",
      ],
    })

    const orderData = {
      id: order.id,
      display_id: (order as any).display_id,
      email: order.email,
      customer_name: order.shipping_address
        ? `${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim()
        : "Guest",
      created_at: order.created_at,
      currency_code: order.currency_code,
      items: order.items?.map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        thumbnail: item.thumbnail,
        product: item.variant?.product
          ? { title: item.variant.product.title }
          : undefined,
      })),
      shipping_address: order.shipping_address,
      total: (order as any).total,
      subtotal: (order as any).subtotal,
      shipping_total: (order as any).shipping_total,
      discount_total: (order as any).discount_total,
      tax_total: (order as any).tax_total,
    }

    // 1. Send confirmation to customer
    await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-confirmed",
      data: orderData,
      trigger_type: "order.placed",
      resource_id: order.id,
      resource_type: "order",
    })

    // 2. Send notification to shop owner
    const shopEmail = process.env.SHOP_OWNER_EMAIL || "info@infinytree.com"
    await notificationService.createNotifications({
      to: shopEmail,
      channel: "email",
      template: "order-confirmed",
      data: { ...orderData, subject: `🛍️ New Order #${orderData.display_id || order.id.slice(-8)} — ${orderData.customer_name}` },
      trigger_type: "order.placed",
      resource_id: order.id,
      resource_type: "order",
    })
  } catch (error: any) {
    logger.error(
      `Failed to send order confirmation for order ${event.data.id}: ${error.message}`
    )
  }
}

export const config = {
  event: "order.placed",
}
