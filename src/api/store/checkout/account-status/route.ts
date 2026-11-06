import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { findAccountId } from "../../../../utils/account-email"

export const AccountStatusSchema = z.object({
  email: z.string().trim().pipe(z.email({ error: "Invalid email address" })),
})

/**
 * Whether an email typed at checkout belongs to an account, so the checkout
 * can leave out the password fields and greet a returning customer instead of
 * refusing their sign-up at the end of the form. It answers only yes or no,
 * which Medusa's own sign-up already tells anyone who tries a registered
 * email, and it is limited per visitor (see `./middlewares`).
 */
export async function POST(
  req: MedusaRequest<z.infer<typeof AccountStatusSchema>>,
  res: MedusaResponse
) {
  const accountId = await findAccountId(req.scope, req.validatedBody.email)

  return res.status(200).json({ has_account: !!accountId })
}
