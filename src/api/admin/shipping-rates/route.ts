import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIPPING_RATES_MODULE } from "../../../modules/shipping-rates"
import { normalizeTable } from "../../../modules/shipping-rates/lib/rates"
import ShippingRatesModuleService from "../../../modules/shipping-rates/service"

/**
 * Every rate table and exchange rate on file, for the admin's Shipping rates
 * screen.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: ShippingRatesModuleService =
    req.scope.resolve(SHIPPING_RATES_MODULE)

  const [tables, currencies] = await Promise.all([
    service.listShippingRateTables({}, { order: { created_at: "ASC" } }),
    service.listShippingRateCurrencies({}, { order: { currency_code: "ASC" } }),
  ])

  return res.json({
    tables: tables.map((table) => ({ id: table.id, ...normalizeTable(table) })),
    currencies: currencies.map((currency) => ({
      id: currency.id,
      currency_code: currency.currency_code,
      // The column keeps about 7 significant digits.
      rate: Number(Number(currency.rate).toPrecision(7)),
    })),
  })
}
