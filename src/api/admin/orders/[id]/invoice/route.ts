import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { generateInvoiceBuffer, InvoiceOrderData } from "../../../../../utils/invoice-pdf"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderService: IOrderModuleService = req.scope.resolve(Modules.ORDER)
  const logger = req.scope.resolve("logger") as any

  const orderId = req.params.id

  try {
    const order = await orderService.retrieveOrder(orderId, {
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
        "item_subtotal",
        "subtotal",
        "shipping_total",
        "shipping_subtotal",
        "discount_total",
        "tax_total",
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
        product: item.product_title
          ? { title: item.product_title }
          : (item.variant?.product
            ? { title: item.variant.product.title }
            : undefined),
        variant: item.variant_title
          ? { title: item.variant_title, sku: item.variant_sku }
          : (item.variant
            ? { title: item.variant.title, sku: item.variant.sku }
            : undefined),
      })),
      total: toNum((order as any).total),
      subtotal: toNum((order as any).item_subtotal ?? (order as any).subtotal),
      shipping_total: toNum((order as any).shipping_subtotal ?? (order as any).shipping_total),
      discount_total: toNum((order as any).discount_total),
      tax_total: toNum((order as any).tax_total),
      vat_number: vatNumber,
      item_subtotal: toNum((order as any).item_subtotal),
      shipping_subtotal: toNum((order as any).shipping_subtotal),
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
    logger.error(`[invoice-admin] Failed to generate invoice for order ${orderId}: ${error.message}`)
    throw error
  }
}
