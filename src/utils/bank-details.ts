/**
 * Shared bank transfer configuration for Infinytree.
 *
 * Used by: order-placed subscriber, invoice PDF, confirmation email, confirmation page.
 * Single source of truth — change bank details once, it updates everywhere.
 *
 * Override via environment variables:
 *   BANK_NAME, BANK_IBAN (EUR fallback), BANK_IBAN_HUF, BANK_IBAN_EUR, BANK_BIC, BANK_BENEFICIARY
 */

export interface BankDetails {
  bankName: string
  iban: string
  bic: string
  beneficiary: string
}

export function getBankDetails(
  displayId?: string | number,
  currencyCode?: string
): BankDetails & { reference: string } {
  const isHuf = (currencyCode || "").toLowerCase() === "huf"
  return {
    bankName: process.env.BANK_NAME || "OTP Bank",
    iban: isHuf
      ? process.env.BANK_IBAN_HUF || "HU49117130812147721600000000"
      : process.env.BANK_IBAN_EUR ||
        process.env.BANK_IBAN ||
        "HU27117631344774788700000000",
    bic: process.env.BANK_BIC || "OTPVHUHBXXX",
    beneficiary: process.env.BANK_BENEFICIARY || "Deltalivings Kft.",
    reference: displayId ? `Order #${displayId}` : "Order reference",
  }
}
