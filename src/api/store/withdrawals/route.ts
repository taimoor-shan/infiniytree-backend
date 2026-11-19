import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import createWithdrawalRequestWorkflow from "../../../workflows/create-withdrawal-request"

export const WithdrawalSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // A pasted address often carries a space
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.email({ error: "Invalid email address" })
  ),
  order_number: z.string().trim().min(1).max(40),
  items: z.string().max(2000).optional(),
  message: z.string().max(2000).optional(),
  // A language tag ("de-AT"): nothing else reaches the CSV export or the emails.
  locale: z
    .string()
    .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
    .max(16)
    .optional(),
})

/**
 * The online withdrawal function ("Withdraw from contract"): saves the
 * consumer's declaration, emails them a confirmation of receipt with its
 * content and time, and alerts the shop. Answers with the time of receipt so
 * the storefront can show the same confirmation on screen.
 */
export async function POST(
  req: MedusaRequest<z.infer<typeof WithdrawalSchema>>,
  res: MedusaResponse
) {
  const { result } = await createWithdrawalRequestWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.status(200).json({
    withdrawal: {
      id: result.id,
      received_at: result.created_at,
      order_number: result.order_number,
    },
  })
}
