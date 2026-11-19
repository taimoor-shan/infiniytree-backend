import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import updateWithdrawalRequestWorkflow from "../../../../workflows/update-withdrawal-request"

/**
 * Marks a declaration as handled (the return and refund were arranged) or
 * back to new. There is no delete: a declaration is a legal record.
 */
export async function POST(
  req: MedusaRequest<{ status: "new" | "handled" }>,
  res: MedusaResponse
) {
  const { result } = await updateWithdrawalRequestWorkflow(req.scope).run({
    input: { id: req.params.id, status: req.validatedBody.status },
  })
  return res.status(200).json({ withdrawal: result })
}
