import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { generateAccessToken, buildOrderAccessUrl } from "../utils/order-url"

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
        "summary",
      ],
      select: [
        "email",
        "display_id",
        "created_at",
        "currency_code",
        "total",
        "subtotal",
        "shipping_total",
        "discount_total",
        "tax_total",
        "customer_id",
        "metadata",
      ],
    })

    // ── Debug: inspect raw values from retrieveOrder ──────────────
    logger.info("[order-placed] Raw order fields:", {
      id: order.id,
      email: order.email,
      display_id: (order as any).display_id,
      currency_code: order.currency_code,
      total_raw: (order as any).total,
      subtotal_raw: (order as any).subtotal,
      shipping_total_raw: (order as any).shipping_total,
      discount_total_raw: (order as any).discount_total,
      tax_total_raw: (order as any).tax_total,
      items_count: order.items?.length,
      has_payment_collections: !!(order as any).payment_collections?.length,
      has_summary: !!(order as any).summary,
    })

    const payment = (order as any).payment_collections?.[0]?.payments?.[0]

    // Generate access token for guest order tracking
    const storefrontUrl = process.env.STOREFRONT_PUBLIC_URL || "https://infinytree.com"
    const existingMetadata = ((order as any).metadata || {}) as Record<string, unknown>
    const { rawToken, tokenHash } = generateAccessToken()

    try {
      await orderService.updateOrders(order.id, {
        metadata: {
          ...existingMetadata,
          order_access_token: rawToken,
          order_access_token_hash: tokenHash,
        },
      })
      logger.info(`[order-placed] Access token stored for order ${order.id}`)
    } catch (err: any) {
      logger.warn(`[order-placed] Failed to store access token for ${order.id}: ${err.message}`)
    }

    const orderUrl = await buildOrderAccessUrl(
      {
        id: order.id,
        display_id: (order as any).display_id,
        customer_id: (order as any).customer_id,
        metadata: { ...existingMetadata, order_access_token: rawToken },
      },
      storefrontUrl,
      container
    )

    const vatNumber = ((order.shipping_address as any)?.metadata?.vat_number as string) || undefined

    // decorCartTotals returns BigNumber instances; extract the raw numeric_
    // value so they survive JSON serialization into the notification.
    const toNum = (v: any): number => {
      if (v == null) return 0
      if (typeof v === "number") return v
      return Number(v?.numeric_ ?? v) || 0
    }

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
        quantity: toNum(item.quantity),
        unit_price: toNum(item.unit_price),
        thumbnail: item.thumbnail,
        product: item.variant?.product
          ? { title: item.variant.product.title }
          : undefined,
      })),
      shipping_address: order.shipping_address,
      company: order.shipping_address?.company,
      vat_number: vatNumber,
      total: toNum((order as any).total),
      subtotal:
        order.items?.reduce(
          (sum: number, item: any) =>
            sum + toNum(item.unit_price) * toNum(item.quantity),
          0
        ) ??
        toNum(
          (order as any).subtotal ??
            (order as any).summary?.subtotal ??
            0
        ),
      shipping_total: toNum((order as any).shipping_total),
      discount_total: toNum((order as any).discount_total),
      tax_total: toNum((order as any).tax_total),
      payment_method: payment
        ? {
            provider_id: payment.provider_id,
            amount: toNum(payment.amount),
          }
        : undefined,
      order_url: orderUrl,
    }

    // ── Debug: inspect converted orderData ────────────────────────
    logger.info("[order-placed] Converted orderData:", {
      id: orderData.id,
      email: orderData.email,
      display_id: orderData.display_id,
      currency_code: orderData.currency_code,
      total: orderData.total,
      subtotal: orderData.subtotal,
      shipping_total: orderData.shipping_total,
      discount_total: orderData.discount_total,
      tax_total: orderData.tax_total,
      items: orderData.items?.map((i: any) => ({
        title: i.title,
        qty: i.quantity,
        unit_price: i.unit_price,
      })),
      has_payment_method: !!orderData.payment_method,
    })

    // 1. Send confirmation to customer
    const to = order.email
    if (!to) {
      logger.error("[order-placed] Customer email is empty — skipping customer notification")
    } else {
      await notificationService.createNotifications({
        to,
        channel: "email",
        template: "order-confirmed",
        data: orderData,
        trigger_type: "order.placed",
        resource_id: order.id,
        resource_type: "order",
      })
      logger.info(`[order-placed] Customer notification queued for ${to}`)
    }

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
    logger.info(`[order-placed] Admin notification queued for ${shopEmail}`)
  } catch (error: any) {
    logger.error(
      `[order-placed] Failed for order ${event.data.id}: ${error.message}`
    )
  }
}

export const config = {
  event: "order.placed",
}
