import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NOTIFY_ME_MODULE } from "../../../modules/notify-me"
import NotifyMeModuleService from "../../../modules/notify-me/service"

/**
 * Everyone who asked to be told when a product is available, newest first.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: NotifyMeModuleService = req.scope.resolve(NOTIFY_ME_MODULE)
  const { q, product_id } = req.validatedQuery
  const limit = req.validatedQuery.limit ?? 20
  const offset = req.validatedQuery.offset ?? 0

  const filters: Record<string, unknown> = {}
  if (product_id) {
    filters.product_id = product_id
  }
  if (q) {
    filters.$or = [
      { email: { $ilike: `%${q}%` } },
      { product_title: { $ilike: `%${q}%` } },
    ]
  }

  const [requests, count] = await service.listAndCountNotifyMeRequests(
    filters,
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )

  return res.json({ requests, count, limit, offset })
}
