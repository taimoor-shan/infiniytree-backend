import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import deleteShippingRateTableWorkflow from "../../../../../workflows/delete-shipping-rate-table"

/**
 * Removes the rates of one shipping class and country. A delivery there then
 * cannot be priced until rates are saved again.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteShippingRateTableWorkflow(req.scope).run({
    input: { id },
  })

  return res.status(200).json({ id })
}
