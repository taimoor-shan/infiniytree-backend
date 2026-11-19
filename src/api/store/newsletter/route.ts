import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import subscribeNewsletterWorkflow from "../../../workflows/subscribe-newsletter"

export const NewsletterSignupSchema = z.object({
  // A pasted address often carries a space
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.email({ error: "Invalid email address" })
  ),
  // A language tag ("de-AT"): nothing else reaches the CSV export or the emails.
  locale: z
    .string()
    .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
    .max(16)
    .optional(),
})

export const NewsletterTokenSchema = z.object({
  action: z.enum(["confirm", "unsubscribe"]),
  token: z.string().min(10).max(200),
})

/**
 * Newsletter sign-up (double opt-in): saves the address as pending and emails
 * a confirmation link. Answers the same for every address.
 */
export async function POST(
  req: MedusaRequest<z.infer<typeof NewsletterSignupSchema>>,
  res: MedusaResponse
) {
  await subscribeNewsletterWorkflow(req.scope).run({ input: req.validatedBody })
  return res.status(200).json({ success: true })
}
