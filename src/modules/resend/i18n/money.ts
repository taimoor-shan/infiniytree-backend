/**
 * Currency formatting helper — mirrors the storefront's `convertToLocale`
 * (infinytree-storefront/src/lib/util/money.ts).
 *
 * Both the storefront and backend receive amounts in **major units** (e.g. 19.50
 * for €19.50), so no division is applied.
 *
 * Explicit minimumFractionDigits ensures decimal places are always shown
 * for decimal currencies; zero-decimal currencies (HUF, JPY, etc.) omit them.
 */

/** ISO-4217 currencies with 0 minor units — no decimal places. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "HUF", "JPY", "KRW", "TWD", "VND",
  "CLP", "PYG", "UGX", "RWF", "UZS", "KES",
])

export const formatPrice = (
  amount: number,
  currencyCode: string,
  locale = "en-US",
  minimumFractionDigits?: number,
  maximumFractionDigits?: number
): string => {
  if (!currencyCode) return amount.toString()

  const upper = currencyCode.toUpperCase()
  const zeroDecimals = ZERO_DECIMAL_CURRENCIES.has(upper)

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: upper,
    minimumFractionDigits:
      minimumFractionDigits ?? (zeroDecimals ? 0 : 2),
    maximumFractionDigits:
      maximumFractionDigits ?? (zeroDecimals ? 0 : 2),
  }).format(amount)
}
