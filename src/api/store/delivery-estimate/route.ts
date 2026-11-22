import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SHIPPING_RATES_MODULE } from "../../../modules/shipping-rates"
import {
  convertFromEuro,
  deliveryPriceRange,
  normalizeTable,
  RateLookupError,
} from "../../../modules/shipping-rates/lib/rates"
import ShippingRatesModuleService from "../../../modules/shipping-rates/service"
import { GetStoreDeliveryEstimateSchema } from "./middlewares"

/**
 * What delivering one unit of a product to a country costs, before the
 * postcode is known: the cheapest and dearest zone of the product's shipping
 * class, net of VAT, in the given currency. The product page shows it next to
 * the price ("Delivery to Austria from 95 €"); the checkout still prices the
 * real delivery from the postcode.
 *
 * Answers 200 with `estimate: null` when there is nothing to say (no class, no
 * rates for the country, no exchange rate), so the page simply leaves the line
 * out and the storefront's data cache can keep the answer.
 */
export async function GET(
  req: MedusaRequest<unknown, GetStoreDeliveryEstimateSchema>,
  res: MedusaResponse
) {
  const { product_id, country_code, currency_code } = req.validatedQuery
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const service: ShippingRatesModuleService =
    req.scope.resolve(SHIPPING_RATES_MODULE)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "shipping_profile.type"],
    filters: { id: product_id },
  })
  const shippingClass = (
    products?.[0] as { shipping_profile?: { type?: string } } | undefined
  )?.shipping_profile?.type?.toLowerCase()

  if (!shippingClass) {
    return res.json({ estimate: null })
  }

  const country = country_code.toLowerCase()
  const currency = (currency_code ?? "eur").toLowerCase()

  const [row] = await service.listShippingRateTables(
    { shipping_class: shippingClass, country_code: country },
    { take: 1 }
  )
  const range = row ? deliveryPriceRange(normalizeTable(row), 1) : null
  if (!range) {
    return res.json({ estimate: null })
  }

  const rates: Record<string, number> = {}
  if (currency !== "eur") {
    for (const rate of await service.listShippingRateCurrencies({
      currency_code: currency,
    })) {
      rates[rate.currency_code] = Number(rate.rate)
    }
  }

  try {
    return res.json({
      estimate: {
        shipping_class: shippingClass,
        country_code: country,
        currency_code: currency,
        min: convertFromEuro(range.min, currency, rates),
        max: convertFromEuro(range.max, currency, rates),
        tax_inclusive: false,
      },
    })
  } catch (error) {
    if (error instanceof RateLookupError) {
      return res.json({ estimate: null })
    }
    throw error
  }
}
