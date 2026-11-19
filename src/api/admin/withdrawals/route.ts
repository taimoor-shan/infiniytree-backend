import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WITHDRAWAL_MODULE } from "../../../modules/withdrawal"
import WithdrawalModuleService from "../../../modules/withdrawal/service"

/** Withdrawal declarations sent from the storefront, newest first. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: WithdrawalModuleService = req.scope.resolve(WITHDRAWAL_MODULE)
  const { status } = req.validatedQuery as { status?: "new" | "handled" }
  const limit = (req.validatedQuery.limit as number | undefined) ?? 50
  const offset = (req.validatedQuery.offset as number | undefined) ?? 0

  const [withdrawals, count] = await service.listAndCountWithdrawalRequests(
    status ? { status } : {},
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )

  return res.json({ withdrawals, count, limit, offset })
}
