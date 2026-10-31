import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import saveShippingCurrencyRateWorkflow from "../../../../workflows/save-shipping-currency-rate"
import { PostAdminShippingCurrencyRateSchema } from "../middlewares"

/**
 * Saves how many units of a currency make one euro, for carts that are not in
 * euro.
 */
export async function POST(
  req: MedusaRequest<PostAdminShippingCurrencyRateSchema>,
  res: MedusaResponse
) {
  const { result } = await saveShippingCurrencyRateWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.status(200).json({ currency: result })
}
