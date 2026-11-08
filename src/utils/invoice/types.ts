/**
 * Type definitions for the invoice system.
 *
 * InvoiceOrderData is the raw data contract (kept verbatim from the original
 * invoice-pdf.tsx — the three API routes build objects against this interface).
 *
 * The component prop interfaces describe pre-formatted strings — the PDF
 * components never touch numbers or dates directly, and never choose a
 * language: every word on the page arrives in `InvoiceLabels`.
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
  /** The language the customer ordered in (en, de-AT, de-DE, hu-HU); empty is English. */
  locale?: string | null
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
  /** The discount with the VAT on it. Only the fallback for `discount_subtotal`. */
  discount_total?: number
  /** The discount without VAT: the figure that fits beside the net rows. */
  discount_subtotal?: number
  /** The promotion codes behind the discount, for its label. */
  discount_codes?: string[]
  tax_total?: number
  vat_number?: string
}

// ---------------------------------------------------------------------------
// Component prop interfaces (pre-formatted strings)
// ---------------------------------------------------------------------------

/** Every fixed word on the page, already in the customer's language. */
export interface InvoiceLabels {
  title: string
  /** The shop's own tax number, in the header */
  vatId: string
  /** The country line of the shop's address (Hungary, Ungarn, Magyarország) */
  companyCountry: string
  invoiceNumber: string
  orderNumber: string
  issueDate: string
  dueDate: string
  billTo: string
  /** The customer's tax number, under Bill To */
  vatNumber: string
  orderSummary: string
  qty: string
  unitPrice: string
  itemTotal: string
  paymentInformation: string
  beneficiary: string
  bank: string
  bic: string
  reference: string
  thankYou: string
  paymentTerms: string
}

/** What a component takes besides its own data when it prints fixed words. */
export interface WithLabels {
  labels: InvoiceLabels
}

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
  subtotalLabel: string
  subtotal: string
  shippingLabel: string
  shipping?: string
  /** "Discount (CODE)": the code is part of the label */
  discountLabel: string
  discount?: string
  vatLabel: string
  vat: string
  totalLabel: string
  total: string
  vatNote: string
}

export interface PaymentInformationProps {
  bank: string
  iban: string
  ibanLabel: string
  bic: string
  beneficiary: string
  reference: string
}

// ---------------------------------------------------------------------------
// View model — the clean shape the PDF renders
// ---------------------------------------------------------------------------

export interface InvoiceViewModel {
  /** en, de-AT, de-DE or hu-HU */
  locale: string
  labels: InvoiceLabels
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
