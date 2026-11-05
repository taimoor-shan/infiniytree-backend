import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DELIVERY_REQUEST_MODULE } from "../../../modules/delivery-request"
import DeliveryRequestModuleService from "../../../modules/delivery-request/service"

/**
 * Delivery quote requests from countries the checkout does not deliver to,
 * newest first.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: DeliveryRequestModuleService = req.scope.resolve(
    DELIVERY_REQUEST_MODULE
  )
  const { q, status } = req.validatedQuery as {
    q?: string
    status?: "new" | "handled"
  }
  const limit = (req.validatedQuery.limit as number | undefined) ?? 20
  const offset = (req.validatedQuery.offset as number | undefined) ?? 0

  const filters: Record<string, unknown> = {}
  if (status) {
    filters.status = status
  }
  if (q) {
    filters.$or = [
      { email: { $ilike: `%${q}%` } },
      { company: { $ilike: `%${q}%` } },
      { last_name: { $ilike: `%${q}%` } },
      { city: { $ilike: `%${q}%` } },
      { country_code: { $ilike: `%${q}%` } },
    ]
  }

  const [requests, count] = await service.listAndCountDeliveryRequests(
    filters,
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )

  return res.json({ requests, count, limit, offset })
}
