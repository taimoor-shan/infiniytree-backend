/**
 * Type definitions for the invoice system.
 *
 * InvoiceOrderData is the raw data contract (kept verbatim from the original
 * invoice-pdf.tsx — the three API routes build objects against this interface).
 *
 * The component prop interfaces describe pre-formatted strings — the PDF
 * components never touch numbers or dates directly.
 */

// ---------------------------------------------------------------------------
// Raw order data (backward-compatible contract with API routes)
// ---------------------------------------------------------------------------

export interface InvoiceOrderData {
  id: string
  display_id?: string | number
  created_at?: string
  currency_code?: string
  email?: string
  shipping_address?: {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    postal_code?: string
    country_code?: string
    metadata?: Record<string, unknown>
  }
  items?: Array<{
    title: string
    quantity: number
    unit_price: number
    product?: { title: string }
    variant?: { title?: string; sku?: string }
  }>
  total?: number
  subtotal?: number
  item_subtotal?: number
  shipping_total?: number
  shipping_subtotal?: number
  discount_total?: number
  tax_total?: number
  vat_number?: string
}

// ---------------------------------------------------------------------------
// Component prop interfaces (pre-formatted strings)
// ---------------------------------------------------------------------------

export interface HeaderProps {
  invoiceNumber: string
  orderNumber: string
  issueDate: string
  dueDate: string
}

export interface BillingDetailsProps {
  company?: string
  firstName?: string
  lastName?: string
  address1?: string
  address2?: string
  city?: string
  postalCode?: string
  country?: string
  vat?: string
}

export interface LineItem {
  title: string
  subtitle?: string
  sku?: string
  quantity: number
  unitPrice: string
  total: string
  /** File path or data-URI for the product thumbnail. */
  image?: string | null
}

export interface TotalsCardProps {
  subtotal: string
  shipping?: string
  discount?: string
  vatLabel: string
  vat: string
  total: string
  vatNote: string
}

export interface PaymentInformationProps {
  bank: string
  iban: string
  bic: string
  beneficiary: string
  reference: string
}

// ---------------------------------------------------------------------------
// View model — the clean shape the PDF renders
// ---------------------------------------------------------------------------

export interface InvoiceViewModel {
  invoiceNumber: string
  orderNumber: string
  issueDate: string
  dueDate: string
  currency: string
  billing: BillingDetailsProps
  items: LineItem[]
  totals: TotalsCardProps
  payment: PaymentInformationProps
}
