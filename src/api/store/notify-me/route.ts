import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import createNotifyMeRequestWorkflow from "../../../workflows/create-notify-me-request"

export const NotifyMeSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  productId: z.string().min(1),
  // Left out when the whole product is out of stock and there is no option to
  // choose, so the signup is for the product itself.
  variantId: z.string().min(1).optional(),
  productUrl: z.string().max(2000).optional(),
  // Sent by storefronts built before the names came from the catalog. Medusa
  // refuses unknown fields, so they stay accepted (and ignored) until every
  // storefront build has stopped sending them.
  productTitle: z.string().optional(),
  variantTitle: z.string().optional(),
})

/**
 * "Notify me when available": saves the signup (the admin lists it under
 * Notify me) and emails the shop. Signing up again with the same email for the
 * same product and variant succeeds without a second entry or email.
 */
export async function POST(
  req: MedusaRequest<z.infer<typeof NotifyMeSchema>>,
  res: MedusaResponse
) {
  const { email, productId, variantId, productUrl } = req.validatedBody

  await createNotifyMeRequestWorkflow(req.scope).run({
    input: {
      email,
      product_id: productId,
      variant_id: variantId,
      product_url: productUrl,
    },
  })

  return res.status(200).json({ success: true })
}
