/**
 * Quick invoice preview — generates a PDF for any order and opens it.
 *
 * Usage:
 *   yarn medusa exec src/scripts/test-invoice.ts -- latest
 *   yarn medusa exec src/scripts/test-invoice.ts -- order_01KZ91YN22X4373D9JPEJKBRF9
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import os from "os"

export default async function testInvoice({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const orderService: IOrderModuleService = container.resolve(Modules.ORDER)

  // medusa exec passes args after --, but process.argv also includes
  // "exec" and the script path. Filter those out.
  const args = process.argv.slice(2).filter(
    a => a && a !== "exec" && a !== "--" && !a.endsWith(".ts") && !a.endsWith(".js")
  )
  const arg = args[args.length - 1]

  if (!arg) {
    console.log(
      "Usage: yarn medusa exec src/scripts/test-invoice.ts -- <orderId | latest>"
    )
    process.exit(1)
  }

  // Resolve order
  let orderId: string

  if (arg === "latest") {
    const [orders] = await orderService.listAndCountOrders(
      {},
      { take: 1 }
    )
    if (!orders?.length) {
      console.log("❌ No orders found.")
      process.exit(1)
    }
    orderId = orders[0].id
    console.log(
      `📋 Latest order: ${orderId} (display #${(orders[0] as any).display_id})`
    )
  } else if (arg.startsWith("order_")) {
    orderId = arg
  } else {
    // Assume it's a raw order ID
    orderId = arg
    console.log(`📋 Looking up: ${orderId}`)
  }

  // Load full order
  console.log("⏳ Loading order...")
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
      "subtotal",
      "item_subtotal",
      "shipping_total",
      "shipping_subtotal",
      "discount_total",
      "tax_total",
      "metadata",
    ],
  })

  // Build InvoiceOrderData
  const toNum = (v: any): number => {
    if (v == null) return 0
    if (typeof v === "number") return v
    return Number(v?.numeric_ ?? v) || 0
  }

  const vatNumber =
    ((order.shipping_address as any)?.metadata?.vat_number as string) ||
    undefined

  const orderData = {
    id: order.id,
    display_id: (order as any).display_id,
    created_at: order.created_at?.toString(),
    currency_code: order.currency_code,
    email: order.email,
    shipping_address: order.shipping_address as any,
    items: ((order.items as any[]) || []).map((item: any) => ({
      title: item.title,
      quantity: toNum(item.quantity),
      unit_price: toNum(item.unit_price),
      product: item.variant?.product
        ? { title: item.variant.product.title }
        : undefined,
    })),
    total: toNum((order as any).total),
    subtotal: toNum(
      (order as any).item_subtotal ?? (order as any).subtotal
    ),
    shipping_total: toNum(
      (order as any).shipping_subtotal ?? (order as any).shipping_total
    ),
    discount_total: toNum((order as any).discount_total),
    tax_total: toNum((order as any).tax_total),
    vat_number: vatNumber,
    item_subtotal: toNum((order as any).item_subtotal),
    shipping_subtotal: toNum((order as any).shipping_subtotal),
  }

  // Generate PDF — use absolute require so it works regardless of CWD
  console.log("🎨 Generating PDF...")
  const invoicePdfPath = path.resolve(__dirname, "..", "utils", "invoice-pdf")
  const { generateInvoiceBuffer } = require(invoicePdfPath)
  const pdfBuffer = await generateInvoiceBuffer(orderData)

  const outPath = path.join(
    os.tmpdir(),
    `invoice-${orderData.display_id || order.id.slice(-8)}.pdf`
  )
  fs.writeFileSync(outPath, pdfBuffer)

  console.log(`✅ PDF: ${outPath}`)
  console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)
  console.log(`   Items: ${orderData.items.length}`)
  console.log(
    `   Total: ${orderData.total} ${orderData.currency_code}`
  )
  console.log(
    `   Customer: ${order.shipping_address?.first_name || "N/A"} ${order.shipping_address?.last_name || ""}`
  )

  // Open in Preview
  execSync(`open "${outPath}"`)
  console.log("📂 Opened in Preview")
}
