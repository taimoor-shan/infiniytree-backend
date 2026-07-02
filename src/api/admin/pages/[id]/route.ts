import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PAGE_MODULE } from "../../../../modules/page"
import PageModuleService from "../../../../modules/page/service"
import deletePageWorkflow from "../../../../workflows/delete-page"
import updatePageWorkflow from "../../../../workflows/update-page"
import { UpdatePageSchema } from "../middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pageModuleService: PageModuleService = req.scope.resolve(PAGE_MODULE)
  const { id } = req.params

  const page = await pageModuleService.retrievePage(id)

  return res.json({ page })
}

export async function POST(
  req: MedusaRequest<UpdatePageSchema>,
  res: MedusaResponse
) {
  const { id } = req.params

  const { result } = await updatePageWorkflow(req.scope).run({
    input: {
      id,
      data: req.validatedBody,
    },
  })

  return res.status(200).json({ page: result.page })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deletePageWorkflow(req.scope).run({
    input: { id },
  })

  return res.status(200).json({ id })
}
