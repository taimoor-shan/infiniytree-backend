import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import saveShippingRateTableWorkflow from "../../../../workflows/save-shipping-rate-table"
import { PostAdminShippingRateTableSchema } from "../middlewares"

/**
 * Saves the rates of one shipping class and country: creates them, or
 * replaces the zones and rows already on file.
 */
export async function POST(
  req: MedusaRequest<PostAdminShippingRateTableSchema>,
  res: MedusaResponse
) {
  const { result } = await saveShippingRateTableWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.status(200).json({ table: result })
}
