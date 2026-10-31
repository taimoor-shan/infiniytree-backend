import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import deleteShippingCurrencyRateWorkflow from "../../../../../workflows/delete-shipping-currency-rate"

/**
 * Removes an exchange rate. Carts in that currency then cannot be given a
 * delivery price until it is saved again.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteShippingCurrencyRateWorkflow(req.scope).run({
    input: { id },
  })

  return res.status(200).json({ id })
}
