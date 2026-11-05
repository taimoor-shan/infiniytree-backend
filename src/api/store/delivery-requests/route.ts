import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import createDeliveryRequestWorkflow from "../../../workflows/create-delivery-request"

const text = (max = 255) => z.string().max(max).optional()

export const DeliveryRequestSchema = z.object({
  cart_id: z.string().min(1),
  email: z.email({ error: "Invalid email address" }),
  first_name: text(),
  last_name: text(),
  company: text(),
  vat_number: text(64),
  phone: text(64),
  address_1: text(),
  address_2: text(),
  postal_code: text(32),
  city: text(),
  province: text(),
  country_code: z.string().regex(/^[a-zA-Z]{2}$/, "Invalid country"),
  message: text(2000),
  locale: text(16),
})

/**
 * "Request a delivery quote": the checkout's answer for a European country
 * the shop has no delivery prices for yet. Saves the cart's products with the
 * address and contact details (Admin → Delivery requests) and emails the shop,
 * so a representative can reply with a price by hand. Nothing is ordered.
 */
export async function POST(
  req: MedusaRequest<z.infer<typeof DeliveryRequestSchema>>,
  res: MedusaResponse
) {
  const { result } = await createDeliveryRequestWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.status(200).json({ success: true, id: result.request.id })
}
