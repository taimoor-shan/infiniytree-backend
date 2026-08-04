/**
 * Shared bank transfer configuration for Infinytree.
 *
 * Used by: order-placed subscriber, invoice PDF, confirmation email, confirmation page.
 * Single source of truth — change bank details once, it updates everywhere.
 *
 * Override via environment variables:
 *   BANK_NAME, BANK_IBAN, BANK_BIC, BANK_BENEFICIARY
 */

export interface BankDetails {
  bankName: string
  iban: string
  bic: string
  beneficiary: string
}

export function getBankDetails(displayId?: string | number): BankDetails & { reference: string } {
  return {
    bankName: process.env.BANK_NAME || "OTP Bank",
    iban: process.env.BANK_IBAN || "HU...",
    bic: process.env.BANK_BIC || "OTPVHUHB",
    beneficiary: process.env.BANK_BENEFICIARY || "Deltalivings Kft.",
    reference: displayId ? `Order #${displayId}` : "Order reference",
  }
}
