import type ShippingRatesModuleService from "../service"
import {
  convertFromEuro,
  normalizeTable,
  quoteDelivery,
  RateLookupError,
  RateQuote,
} from "./rates"

export type DeliveryQuote = RateQuote & {
  shipping_class: string
  country_code: string
  /** The cart's currency, lower case. */
  currency_code: string
  /** `amount` (euro) in `currency_code`, rounded to cents. What the cart pays, before tax. */
  charge: number
}

/**
 * What delivering `units` of a shipping class to a country and postcode costs
 * in the given currency, read from the rates on file. The one place the
 * checkout and the admin's "try it" calculator both price a delivery.
 *
 * Throws a `RateLookupError` saying what is missing (no rates for that
 * country, no zone for the postcode, no exchange rate for the currency).
 */
export async function quoteFromStore(
  service: ShippingRatesModuleService,
  input: {
    shipping_class: string
    country_code: string
    postcode?: string | null
    units: number
    currency_code: string
  }
): Promise<DeliveryQuote> {
  const shippingClass = input.shipping_class.toLowerCase()
  const countryCode = input.country_code.toLowerCase()
  const currencyCode = input.currency_code.toLowerCase()

  const [row] = await service.listShippingRateTables(
    { shipping_class: shippingClass, country_code: countryCode },
    { take: 1 }
  )
  if (!row) {
    throw new RateLookupError(
      "no_table",
      `There are no ${shippingClass} delivery rates for ${countryCode.toUpperCase()}.`
    )
  }

  const quote = quoteDelivery(normalizeTable(row), {
    postcode: input.postcode,
    units: input.units,
  })

  const rates: Record<string, number> = {}
  if (currencyCode !== "eur") {
    const rows = await service.listShippingRateCurrencies({
      currency_code: currencyCode,
    })
    for (const rate of rows) {
      rates[rate.currency_code] = Number(rate.rate)
    }
  }

  return {
    ...quote,
    shipping_class: shippingClass,
    country_code: countryCode,
    currency_code: currencyCode,
    charge: convertFromEuro(quote.amount, currencyCode, rates),
  }
}
