import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import setNewsletterStatusWorkflow from "../../../../workflows/set-newsletter-status"
import { NewsletterTokenSchema } from "../route"

/**
 * The links in the emails: `{ action: "confirm" }` confirms a sign-up,
 * `{ action: "unsubscribe" }` takes an address off. A POST, called by the
 * storefront's page after the visitor opens the link, so a mail scanner that
 * opens every link cannot confirm or unsubscribe anyone by itself.
 */
export async function POST(
  req: MedusaRequest<z.infer<typeof NewsletterTokenSchema>>,
  res: MedusaResponse
) {
  const { result } = await setNewsletterStatusWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  return res.status(200).json({ found: result.found })
}
