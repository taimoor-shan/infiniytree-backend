import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PAGE_MODULE } from "../../../modules/page"
import PageModuleService from "../../../modules/page/service"
import createPageWorkflow from "../../../workflows/create-page"
import { CreatePageSchema } from "./middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pageModuleService: PageModuleService = req.scope.resolve(PAGE_MODULE)
  const { q, status } = req.validatedQuery
  const limit = req.validatedQuery.limit ?? 20
  const offset = req.validatedQuery.offset ?? 0

  const filters: Record<string, unknown> = {}
  if (q) {
    filters.title = { $like: `%${q}%` }
  }
  if (status) {
    filters.status = status
  }

  const [pages, count] = await pageModuleService.listAndCountPages(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  return res.json({
    pages,
    count,
    limit,
    offset,
  })
}

export async function POST(
  req: MedusaRequest<CreatePageSchema>,
  res: MedusaResponse
) {
  const { result } = await createPageWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.status(200).json({ page: result.page })
}
