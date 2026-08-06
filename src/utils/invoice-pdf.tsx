/**
 * Invoice PDF entry point — thin re-export shim.
 *
 * The full implementation lives in src/utils/invoice/.
 * This file preserves backward compatibility with the three API routes:
 * - src/api/store/orders/[id]/invoice/route.ts
 * - src/api/store/orders/guest/[displayId]/invoice/route.ts
 * - src/api/admin/orders/[id]/invoice/route.ts
 *
 * Signature: generateInvoiceBuffer(order: InvoiceOrderData): Promise<Buffer>
 */

export { generateInvoiceBuffer } from "./invoice/InvoiceDocument"
export type { InvoiceOrderData } from "./invoice/types"
