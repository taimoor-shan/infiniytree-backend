import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import deleteNotifyMeRequestWorkflow from "../../../../workflows/delete-notify-me-request"

/**
 * Removes one signup, for a visitor who asks for their address to be erased or
 * once they have been told the product is back.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteNotifyMeRequestWorkflow(req.scope).run({
    input: { id },
  })

  return res.status(200).json({ id })
}
