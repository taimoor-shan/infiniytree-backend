import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { hashToken, generateAccessToken, buildOrderAccessUrl } from "../../../../../utils/order-url"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query") as any
  const orderService: IOrderModuleService = req.scope.resolve(Modules.ORDER)
  const logger = req.scope.resolve("logger") as any

  const displayId = Number(req.params.displayId)
  const incomingToken = (req.validatedQuery as any).token as string

  if (!incomingToken) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Token is required")
  }

  // Find order by display_id
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "customer_id", "metadata", "fulfillment_status", "payment_status"],
    filters: { display_id: displayId },
    pagination: { take: 1, skip: 0 },
  })

  if (!orders?.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  const orderMeta = orders[0].metadata || {}

  // Hash incoming token and compare with stored hash
  const incomingHash = hashToken(incomingToken)
  const storedHash = orderMeta.order_access_token_hash

  if (storedHash && storedHash !== incomingHash) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  // Lazy-generate token for legacy orders that don't have one
  if (!orderMeta.order_access_token) {
    const { rawToken, tokenHash } = generateAccessToken()
    try {
      await orderService.updateOrders(orders[0].id, {
        metadata: {
          ...orderMeta,
          order_access_token: rawToken,
          order_access_token_hash: tokenHash,
        },
      })
      logger.info(`[guest-orders] Lazy-generated access token for legacy order ${orders[0].id}`)
    } catch (err: any) {
      logger.warn(`[guest-orders] Failed to lazy-generate token for ${orders[0].id}: ${err.message}`)
    }
  }

  // Load full order with all relations needed by the storefront template
  const order = await orderService.retrieveOrder(orders[0].id, {
    relations: [
      "items",
      "items.variant",
      "items.variant.product",
      "fulfillments",
      "fulfillments.labels",
      "shipping_address",
      "shipping_methods",
    ],
    select: [
      "email",
      "display_id",
      "created_at",
      "currency_code",
      "fulfillment_status",
      "payment_status",
      "total",
      "subtotal",
      "shipping_total",
      "discount_total",
      "tax_total",
      "gift_card_total",
    ],
  })

  return res.json({ order })
}
