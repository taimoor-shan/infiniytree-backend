/**
 * Public API for the invoice module.
 *
 * Re-exports everything external consumers need.
 * All three API routes + the old invoice-pdf.tsx shim import from here.
 */

export { generateInvoiceBuffer } from "./InvoiceDocument"
export type { InvoiceOrderData } from "./types"
export type { InvoiceViewModel } from "./types"
