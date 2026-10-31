import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { SHIPPING_RATES_MODULE } from "../../../../modules/shipping-rates"
import { quoteFromStore } from "../../../../modules/shipping-rates/lib/quote"
import { RateLookupError } from "../../../../modules/shipping-rates/lib/rates"
import ShippingRatesModuleService from "../../../../modules/shipping-rates/service"
import { GetAdminShippingQuoteSchema } from "../middlewares"

/**
 * What a delivery would cost, worked out from the rates on file exactly as
 * the checkout does it. Lets the admin try a postcode and a quantity (and so
 * see which zone it lands in) before a customer does.
 */
export async function GET(
  req: MedusaRequest<unknown, GetAdminShippingQuoteSchema>,
  res: MedusaResponse
) {
  const service: ShippingRatesModuleService =
    req.scope.resolve(SHIPPING_RATES_MODULE)
  const query = req.validatedQuery

  try {
    const quote = await quoteFromStore(service, {
      shipping_class: query.shipping_class,
      country_code: query.country_code,
      postcode: query.postcode,
      units: query.units,
      currency_code: query.currency_code ?? "eur",
    })
    return res.json({ quote })
  } catch (error) {
    if (error instanceof RateLookupError) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message)
    }
    throw error
  }
}
