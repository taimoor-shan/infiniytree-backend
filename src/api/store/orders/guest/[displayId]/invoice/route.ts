import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { hashToken } from "../../../../../../utils/order-url"
import { generateInvoiceBuffer, InvoiceOrderData } from "../../../../../../utils/invoice-pdf"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query") as any
  const orderService: IOrderModuleService = req.scope.resolve(Modules.ORDER)
  const logger = req.scope.resolve("logger") as any

  const displayId = Number(req.params.displayId)
  const incomingToken = (req.validatedQuery as any)?.token as string

  if (!incomingToken) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Token is required")
  }

  // Find order by display_id
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { display_id: displayId },
    pagination: { take: 1, skip: 0 },
  })

  if (!orders?.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  const orderMeta = orders[0].metadata || {}

  // Validate token
  const incomingHash = hashToken(incomingToken)
  const storedHash = orderMeta.order_access_token_hash

  if (storedHash && storedHash !== incomingHash) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  // Load full order
  try {
    const order = await orderService.retrieveOrder(orders[0].id, {
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
        "metadata",
      ],
    })

    const toNum = (v: any): number => {
      if (v == null) return 0
      if (typeof v === "number") return v
      return Number(v?.numeric_ ?? v) || 0
    }

    const vatNumber =
      ((order.shipping_address as any)?.metadata?.vat_number as string) || undefined

    const orderData: InvoiceOrderData = {
      id: order.id,
      display_id: (order as any).display_id,
      created_at: order.created_at?.toString(),
      currency_code: order.currency_code,
      email: order.email,
      shipping_address: order.shipping_address as any,
      items: (order.items as any[])?.map((item: any) => ({
        title: item.title,
        quantity: toNum(item.quantity),
        unit_price: toNum(item.unit_price),
        product: item.variant?.product
          ? { title: item.variant.product.title }
          : undefined,
      })),
      total: toNum((order as any).total),
      subtotal: toNum((order as any).subtotal ?? (order as any).summary?.subtotal),
      shipping_total: toNum((order as any).shipping_total),
      discount_total: toNum((order as any).discount_total),
      tax_total: toNum((order as any).tax_total),
      vat_number: vatNumber,
    }

    const pdfBuffer = await generateInvoiceBuffer(orderData)

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="INV-${orderData.display_id || order.id.slice(-8)}.pdf"`
    )
    res.setHeader("Content-Length", pdfBuffer.length.toString())
    return res.send(pdfBuffer)
  } catch (error: any) {
    logger.error(`[invoice-guest] Failed to generate invoice for ${displayId}: ${error.message}`)
    throw error
  }
}
