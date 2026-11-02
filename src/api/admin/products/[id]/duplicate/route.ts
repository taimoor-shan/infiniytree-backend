import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { duplicateProductWorkflow } from "../../../../../workflows/duplicate-product"
import { DuplicateProductSchema } from "../../middlewares"

/**
 * Makes a draft copy of the product under a new title. The copy's handle is
 * made from the title; everything else is the original's.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<DuplicateProductSchema>,
  res: MedusaResponse
) {
  const { result } = await duplicateProductWorkflow(req.scope).run({
    input: {
      product_id: req.params.id,
      title: req.validatedBody.title,
    },
  })

  res.status(200).json({ product: result })
}
