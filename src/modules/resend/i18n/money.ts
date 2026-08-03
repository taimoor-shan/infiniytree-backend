/**
 * Currency formatting helper — mirrors the storefront's `convertToLocale`
 * (nfiniytree-storefront/src/lib/util/money.ts).
 *
 * Both the storefront and backend receive amounts in **major units** (e.g. 19.50
 * for €19.50), so no division is applied.
 *
 * Explicit minimumFractionDigits: 2 ensures decimal places are always shown,
 * regardless of ICU data or environment quirks.
 */
export const formatPrice = (
  amount: number,
  currencyCode: string,
  locale = "en-US",
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string => {
  return currencyCode
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode.toUpperCase(),
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(amount)
    : amount.toString()
}
