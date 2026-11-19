import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WITHDRAWAL_MODULE } from "../../modules/withdrawal"
import WithdrawalModuleService from "../../modules/withdrawal/service"
import type { WithdrawalEmailInput } from "../../utils/withdrawal"

export type CreateWithdrawalRequestStepInput = {
  name: string
  email: string
  order_number: string
  items?: string
  message?: string
  locale?: string
}

export type WithdrawalRequestRecord = WithdrawalEmailInput & {
  status: "new" | "handled"
  order_id: string | null
}

/** "#1042", "1042 " and "Nr. 1042" all mean order 1042. */
export const parseOrderNumber = (value: string): number | null => {
  const digits = value.replace(/\D/g, "")
  if (!digits || digits.length > 9) {
    return null
  }
  return Number(digits)
}

/**
 * Saves the declaration. It is linked to the order only when the number and
 * the email both match one, so a stranger cannot attach a declaration to
 * someone else's order; an unmatched one is still saved, because the shop
 * has to answer every declaration.
 */
export const createWithdrawalRequestStep = createStep(
  "create-withdrawal-request",
  async (input: CreateWithdrawalRequestStepInput, { container }) => {
    const service: WithdrawalModuleService = container.resolve(WITHDRAWAL_MODULE)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const email = input.email.trim()
    const displayId = parseOrderNumber(input.order_number)
    let order: { id: string; display_id: number } | null = null

    if (displayId !== null) {
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "display_id", "email"],
        filters: { display_id: displayId },
        pagination: { take: 1, skip: 0 },
      })
      const found = data?.[0] as
        | { id: string; display_id: number; email?: string | null }
        | undefined
      if (found && found.email?.trim().toLowerCase() === email.toLowerCase()) {
        order = { id: found.id, display_id: found.display_id }
      }
    }

    const created = await service.createWithdrawalRequests({
      name: input.name.trim(),
      email,
      order_number: input.order_number.trim(),
      order_id: order?.id ?? null,
      order_display_id: order?.display_id ?? null,
      items: input.items?.trim() || null,
      message: input.message?.trim() || null,
      locale: input.locale || null,
    })

    return new StepResponse(
      created as unknown as WithdrawalRequestRecord,
      created.id
    )
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: WithdrawalModuleService = container.resolve(WITHDRAWAL_MODULE)
    await service.deleteWithdrawalRequests(id)
  }
)
