import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import deleteDeliveryRequestWorkflow from "../../../../workflows/delete-delivery-request"
import updateDeliveryRequestWorkflow from "../../../../workflows/update-delivery-request"

/** Marks a request as handled (a quote was sent) or back to new. */
export async function POST(
  req: MedusaRequest<{ status: "new" | "handled" }>,
  res: MedusaResponse
) {
  const { result } = await updateDeliveryRequestWorkflow(req.scope).run({
    input: { id: req.params.id, status: req.validatedBody.status },
  })

  return res.status(200).json({ request: result })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteDeliveryRequestWorkflow(req.scope).run({
    input: { id },
  })

  return res.status(200).json({ id })
}
